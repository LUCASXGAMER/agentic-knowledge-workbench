import { App, Button, Card, Table, Tag, Typography } from "antd";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useApiData } from "../hooks/useApiData";
import type { EvalRun } from "../types";

const labels: Record<string, string> = {
  total_cases: "样例总数", answerable_cases: "有预期来源的问题", evaluated_cases: "实际检索问题数",
  routing_cases_not_evaluated: "未在此处评估的拒答问题", top1_hit_rate: "文档 Hit@1",
  top3_hit_rate: "文档 Hit@3", top5_hit_rate: "文档 Hit@5", mrr: "文档 MRR"
};

export function EvalPage() {
  const { message } = App.useApp();
  const runs = useApiData<EvalRun[]>(async () => (await api.get("/eval/runs")).data, []);
  const latest = runs.data[0];
  const rows = Object.entries(labels).map(([key, label]) => {
    const value = latest?.metrics?.[key];
    return { key, label, value: value == null ? "尚未测量" : key.includes("cases") ? String(value) : key === "mrr" ? Number(value).toFixed(3) : `${(Number(value) * 100).toFixed(1)}%` };
  });
  async function runEval() {
    try {
      await api.post("/eval/sample");
      runs.setData((await api.get("/eval/runs")).data);
    } catch { message.error("运行失败，请检查后端、权限和合成样例索引"); }
  }
  return <>
    <PageHeader title="检索评测" description="使用合成问答和预期文件名，实际调用当前检索器计算命中率与排序指标。" />
    <Card title="当前结果" extra={<Button type="primary" onClick={runEval}>运行检索评测</Button>}>
      <Typography.Paragraph type="secondary">请先导入合成样例。每个问题只有一个预期文件；缺少该文件按未命中计算。指标只衡量当前样例的检索，不能代表真实模型的回答质量。引用忠实度、拒答率和幻觉率尚未测量。</Typography.Paragraph>
      <Table rowKey="key" pagination={false} dataSource={rows} columns={[{ title: "指标", dataIndex: "label" }, { title: "结果", dataIndex: "value" }]} />
    </Card>
    <Card className="mt-4" title="运行记录"><Table rowKey="id" loading={runs.loading} dataSource={runs.data} columns={[
      { title: "名称", dataIndex: "name" }, { title: "状态", dataIndex: "status", render: (value) => <Tag>{value === "success" ? "已计算" : "请先导入样例"}</Tag> }, { title: "时间", dataIndex: "created_at" }
    ]} /></Card>
  </>;
}
