import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import { scoreColor, scoreHex } from "./brand";

/** Radial gauge for the overall 0-100 health score. */
export function ScoreGauge({ score }: { score: number }) {
  const data = [{ name: "score", value: score, fill: scoreHex(score) }];
  return (
    <div className="relative h-44 w-44">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="74%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: "rgba(15,23,42,0.07)" }} dataKey="value" cornerRadius={20} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-display text-5xl ${scoreColor(score)}`}>{score}</span>
        <span className="text-xs uppercase tracking-wider text-slate-400">Health</span>
      </div>
    </div>
  );
}
