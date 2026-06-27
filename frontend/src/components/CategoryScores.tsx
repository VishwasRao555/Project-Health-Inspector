import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { CATEGORIES, type Category } from "../types/contract";
import { scoreColor } from "./brand";

interface Props {
  scores: Record<Category, number>;
}

/** Six-category radar plus a compact per-category bar list. */
export function CategoryScores({ scores }: Props) {
  const data = CATEGORIES.map((c) => ({ category: shortLabel(c), score: scores[c] }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card">
        <h3 className="mb-1 text-sm font-semibold text-white">Category radar</h3>
        <p className="mb-2 text-xs text-gray-500">Higher is healthier across all six dimensions.</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="72%">
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="category" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                dataKey="score"
                stroke="#38bdf8"
                fill="#38bdf8"
                fillOpacity={0.25}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 text-sm font-semibold text-white">Scores by category</h3>
        <ul className="space-y-3.5">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-gray-300">{c}</span>
                <span className={`font-mono font-medium ${scoreColor(scores[c])}`}>{scores[c]}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-accent-cyan/80"
                  style={{ width: `${scores[c]}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function shortLabel(c: Category): string {
  return c === "Code Quality" ? "Quality" : c === "Documentation" ? "Docs" : c;
}
