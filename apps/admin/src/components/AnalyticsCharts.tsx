"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { Card } from "@exhibition/ui";

const COLORS = ["#c9a227", "#d4782e", "#eadcc4", "#8b2e1f"];

export function AnalyticsCharts(props: {
  categoryVotes: { name: string; value: number }[];
  topProjects: { name: string; votes: number }[];
  votesOverTime: { day: string; value: number }[];
  topSchools: { name: string; votes: number }[];
}) {
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      <Card className="min-w-0 overflow-hidden">
        <h2 className="mb-4 font-display text-xl sm:text-2xl">Projects by group</h2>
        <div className="h-52 w-full min-w-0 sm:h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={props.categoryVotes} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {props.categoryVotes.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="min-w-0 overflow-hidden">
        <h2 className="mb-4 font-display text-xl sm:text-2xl">Top projects</h2>
        <div className="h-52 w-full min-w-0 sm:h-64">
          <ResponsiveContainer>
            <BarChart data={props.topProjects}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3d281c" />
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="votes" fill="#c9a227" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="min-w-0 overflow-hidden">
        <h2 className="mb-4 font-display text-xl sm:text-2xl">Votes over time</h2>
        <div className="h-52 w-full min-w-0 sm:h-64">
          <ResponsiveContainer>
            <LineChart data={props.votesOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3d281c" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#d4782e" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="min-w-0 overflow-hidden">
        <h2 className="mb-4 font-display text-xl sm:text-2xl">Top schools</h2>
        <div className="h-52 w-full min-w-0 sm:h-64">
          <ResponsiveContainer>
            <BarChart data={props.topSchools}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3d281c" />
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="votes" fill="#e8a05a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
