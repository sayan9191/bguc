/**
 * Inspect and import exhibition_students.csv into Supabase.
 * Idempotent: uses import_fingerprint UNIQUE on students.
 *
 * Usage:
 *   npx tsx scripts/import-students.ts --inspect-only
 *   npx tsx scripts/import-students.ts
 */
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Row = Record<string, string>;

function loadEnv() {
  const files = [".env.local", ".env"];
  for (const file of files) {
    const p = resolve(process.cwd(), file);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function normalizeSpace(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizePhone(value: string): string | null {
  const d = digitsOnly(value);
  if (!d) return null;
  if (d.length === 10) return `+91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `+91${d.slice(1)}`;
  if (d.length === 12 && d.startsWith("91")) return `+${d}`;
  if (d.length >= 10 && d.length <= 15) return `+${d}`;
  return value.trim();
}

function isLikelyInvalidPhone(value: string | null, original: string): boolean {
  if (!original.trim()) return false;
  const d = digitsOnly(original);
  return d.length < 10 || d.length > 15;
}

function findColumn(headers: string[], patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const hit = headers.find((h) => pattern.test(h));
    if (hit) return hit;
  }
  return null;
}

function fingerprint(parts: string[]): string {
  return parts
    .map((p) => normalizeSpace(p).toLowerCase())
    .join("|")
    .replace(/[^a-z0-9|]+/g, "");
}

function inferClassGroup(className: string): "A" | "B" {
  const digits = className.match(/(\d+)/);
  if (digits) return parseInt(digits[1], 10) <= 5 ? "A" : "B";
  if (/পঞ্চম|চতুর্থ|তৃতীয়|দ্বিতীয়|প্রথম|nursery|kg|prep|প্রাথমিক/i.test(className)) return "A";
  return "B";
}

function parseTimestamp(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

async function main() {
  loadEnv();
  const inspectOnly = process.argv.includes("--inspect-only");
  const csvPath = resolve(process.cwd(), process.env.CSV_PATH || "data/exhibition_students.csv");

  console.log("============================================================");
  console.log("CSV INSPECTION");
  console.log("============================================================");
  console.log(`Path: ${csvPath}`);

  if (!existsSync(csvPath)) {
    console.error("\nCSV file was not found.");
    console.error("Place the Google Sheet export at data/exhibition_students.csv and re-run:");
    console.error("  npm run inspect:csv");
    console.error("  npm run import:students");
    process.exit(1);
  }

  const raw = readFileSync(csvPath, "utf8");
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as Row[];

  const headers = records.length ? Object.keys(records[0]) : [];
  console.log("\nExact columns:");
  headers.forEach((h, i) => console.log(`  ${i + 1}. ${JSON.stringify(h)}`));
  console.log(`\nTotal data rows: ${records.length}`);

  const colTimestamp = findColumn(headers, [/timestamp/i, /time stamp/i, /submitted/i]);
  const colClass = findColumn(headers, [/^class$/i, /class name/i, /standard/i, /grade/i]);
  const colModel = findColumn(headers, [/model/i, /project/i, /exhibit/i]);
  const colStudents = findColumn(headers, [/student/i, /participant/i, /team/i, /name of the student/i]);
  const colContact = findColumn(headers, [/contact/i, /phone/i, /mobile/i]);
  const colWhatsapp = findColumn(headers, [/whats?app/i]);
  const colSchool = findColumn(headers, [/school/i, /institution/i, /college/i]);
  const colGuardianName = findColumn(headers, [/guardian.*name/i, /parent.*name/i]);
  const colGuardianContact = findColumn(headers, [/guardian.*contact/i, /parent.*phone/i, /parent.*contact/i]);
  const colCategory = findColumn(headers, [/categor/i, /stream/i, /section type/i]);
  const colDescription = findColumn(headers, [/description/i, /about/i, /details/i]);

  console.log("\nMapped fields:");
  console.log({
    timestamp: colTimestamp,
    class: colClass,
    model: colModel,
    students: colStudents,
    contact: colContact,
    whatsapp: colWhatsapp,
    school: colSchool,
    guardianName: colGuardianName,
    guardianContact: colGuardianContact,
    category: colCategory,
    description: colDescription,
  });

  const missingCounts: Record<string, number> = {};
  for (const h of headers) {
    missingCounts[h] = records.filter((r) => !normalizeSpace(r[h])).length;
  }
  console.log("\nMissing values by column:");
  for (const [h, n] of Object.entries(missingCounts)) {
    console.log(`  ${h}: ${n}`);
  }

  let missingModel = 0;
  let missingStudent = 0;
  let invalidPhones = 0;
  const fingerprints = new Map<string, number>();
  const modelKeys = new Map<string, number>();

  const prepared = records.map((row, index) => {
    const model = normalizeSpace(colModel ? row[colModel] : "");
    const students = normalizeSpace(colStudents ? row[colStudents] : "");
    const school = titleCase(normalizeSpace(colSchool ? row[colSchool] : ""));
    const className = normalizeSpace(colClass ? row[colClass] : "");
    const contactOriginal = normalizeSpace(colContact ? row[colContact] : "");
    const whatsappOriginal = normalizeSpace(colWhatsapp ? row[colWhatsapp] : "");
    const contact = contactOriginal ? normalizePhone(contactOriginal) : null;
    const whatsapp = whatsappOriginal ? normalizePhone(whatsappOriginal) : null;
    const classGroup = inferClassGroup(className);

    if (!model) missingModel += 1;
    if (!students) missingStudent += 1;
    if (isLikelyInvalidPhone(contact, contactOriginal) || isLikelyInvalidPhone(whatsapp, whatsappOriginal)) {
      invalidPhones += 1;
    }

    const fp = fingerprint([model, students, school, className]);
    fingerprints.set(fp, (fingerprints.get(fp) ?? 0) + 1);
    const mk = fingerprint([model, school]);
    modelKeys.set(mk, (modelKeys.get(mk) ?? 0) + 1);

    return {
      index: index + 2,
      model,
      students,
      school,
      className,
      contact,
      whatsapp,
      contactOriginal,
      whatsappOriginal,
      classGroup,
      description: normalizeSpace(colDescription ? row[colDescription] : ""),
      guardianName: normalizeSpace(colGuardianName ? row[colGuardianName] : "") || null,
      guardianContact: colGuardianContact ? normalizePhone(row[colGuardianContact]) : null,
      originalTimestamp: colTimestamp ? parseTimestamp(row[colTimestamp]) : null,
      fingerprint: fp,
      raw: row,
    };
  });

  const duplicateRows = [...fingerprints.entries()].filter(([, n]) => n > 1);
  const duplicateProjects = [...modelKeys.entries()].filter(([k, n]) => n > 1 && k !== "|");

  console.log("\nQuality:");
  console.log(`  Rows missing model names: ${missingModel}`);
  console.log(`  Rows missing student names: ${missingStudent}`);
  console.log(`  Rows with invalid phone/WhatsApp numbers: ${invalidPhones}`);
  console.log(`  Duplicate record groups (same model+students+school+class): ${duplicateRows.length}`);
  console.log(`  Possible duplicate projects (same model+school): ${duplicateProjects.length}`);

  const report = {
    csvRows: records.length,
    columns: headers,
    missingModel,
    missingStudent,
    invalidPhones,
    duplicateRecordGroups: duplicateRows.length,
    possibleDuplicateProjects: duplicateProjects.length,
    imported: 0,
    skippedDuplicates: 0,
    skippedMissingModel: 0,
    skippedMissingStudent: 0,
  };

  if (inspectOnly) {
    const out = resolve(process.cwd(), "data/import-report.json");
    writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(`\nWrote inspection report to ${out}`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Import requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const seen = new Set<string>();
  for (const row of prepared) {
    if (!row.model) {
      report.skippedMissingModel += 1;
      continue;
    }
    if (!row.students) {
      report.skippedMissingStudent += 1;
      continue;
    }
    if (seen.has(row.fingerprint)) {
      report.skippedDuplicates += 1;
      continue;
    }
    seen.add(row.fingerprint);

    const { data: existing } = await supabase
      .from("students")
      .select("id")
      .eq("import_fingerprint", row.fingerprint)
      .maybeSingle();

    if (existing?.id) {
      report.skippedDuplicates += 1;
      continue;
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .insert({
        student_names: row.students,
        class_name: row.className,
        class_group: row.classGroup,
        school_name: row.school,
        contact_number: row.contact,
        whatsapp_number: row.whatsapp,
        guardian_name: row.guardianName,
        guardian_contact: row.guardianContact,
        import_fingerprint: row.fingerprint,
        original_registration_at: row.originalTimestamp,
        raw_import: row.raw,
      })
      .select("id")
      .single();

    if (studentError || !student) {
      console.error(`Row ${row.index} student insert failed:`, studentError?.message);
      continue;
    }

    const members = row.students
      .split(/,|&|\/| and /i)
      .map((n) => n.trim())
      .filter(Boolean);

    const { error: projectError } = await supabase.from("projects").insert({
      model_name: row.model,
      description: row.description || null,
      category: "Science",
      class_group: row.classGroup,
      student_id: student.id,
      approval_status: "PENDING",
      school_name: row.school,
      class_name: row.className,
      team_display_names: members.join(", "),
    });

    if (projectError) {
      console.error(`Row ${row.index} project insert failed:`, projectError.message);
      continue;
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (project?.id) {
      await supabase.from("project_members").insert(
        members.map((student_name) => ({
          project_id: project.id,
          student_name,
          class_name: row.className,
          school_name: row.school,
        }))
      );
    }

    report.imported += 1;
  }

  await supabase.rpc("sync_project_code_sequences" as never);

  console.log("\n============================================================");
  console.log("IMPORT REPORT");
  console.log("============================================================");
  console.log(`CSV rows: ${report.csvRows}`);
  console.log(`Imported: ${report.imported}`);
  console.log(`Duplicates skipped: ${report.skippedDuplicates}`);
  console.log(`Missing model: ${report.skippedMissingModel}`);
  console.log(`Missing student: ${report.skippedMissingStudent}`);

  const out = resolve(process.cwd(), "data/import-report.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
