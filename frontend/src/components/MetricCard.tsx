import { Card, Typography } from "antd";
import type { Metric } from "../types";

const toneMap: Record<Metric["tone"], string> = {
  blue: "#2563eb",
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626"
};

export function MetricCard({ metric }: { metric: Metric }) {
  return (
    <Card className="h-full min-h-[104px]" styles={{ body: { padding: 18 } }}>
      <Typography.Text type="secondary" className="text-xs">
        {metric.label}
      </Typography.Text>
      <Typography.Title level={3} className="!mb-1 !mt-1 !text-[32px] !tracking-[-0.03em]" style={{ color: toneMap[metric.tone] }}>
        {metric.value}
      </Typography.Title>
      <Typography.Text type="secondary" className="text-xs">
        {metric.trend}
      </Typography.Text>
    </Card>
  );
}
