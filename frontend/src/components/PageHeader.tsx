import { Typography } from "antd";
import type { ReactNode } from "react";

export function PageHeader({ title, description, extra }: { title: string; description: string; extra?: ReactNode }) {
  return (
    <div className="prototype-page-title mb-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography.Title level={2} className="!mb-1">
            {title}
          </Typography.Title>
          <Typography.Text type="secondary">{description}</Typography.Text>
        </div>
        {extra}
      </div>
    </div>
  );
}
