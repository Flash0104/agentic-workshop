"use client";

import {
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
} from "recharts";

interface ScoreRadarProps {
  scores: {
    content: number;
    communication: number;
    structure: number;
    empathy: number;
    goal: number;
  };
}

export function ScoreRadar({ scores }: ScoreRadarProps) {
  const data = [
    { dimension: "Content", value: scores.content, fullMark: 20 },
    { dimension: "Communication", value: scores.communication, fullMark: 20 },
    { dimension: "Structure", value: scores.structure, fullMark: 20 },
    { dimension: "Empathy", value: scores.empathy, fullMark: 20 },
    { dimension: "Goal", value: scores.goal, fullMark: 20 },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="dimension" />
        <PolarRadiusAxis angle={90} domain={[0, 20]} />
        <Radar
          name="Score"
          dataKey="value"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.6}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}








