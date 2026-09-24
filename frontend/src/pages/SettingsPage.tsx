import { Card, Descriptions, Tag, Timeline, Typography } from "antd";
import { PageHeader } from "../components/PageHeader";

export function SettingsPage() {
  return (
    <>
      <PageHeader title="系统设置页" description="配置系统入口、数据目录、备份恢复、内网访问和运行状态。" />
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="部署状态">
          <Descriptions column={1}>
            <Descriptions.Item label="系统环境">企业内网</Descriptions.Item>
            <Descriptions.Item label="部署模式">内网部署</Descriptions.Item>
            <Descriptions.Item label="监听地址">0.0.0.0</Descriptions.Item>
            <Descriptions.Item label="访问端口">8080</Descriptions.Item>
          </Descriptions>
        </Card>
        <Card title="备份恢复">
          <Descriptions column={1}>
            <Descriptions.Item label="上传文件">原始上传文件</Descriptions.Item>
            <Descriptions.Item label="业务数据">业务元数据</Descriptions.Item>
            <Descriptions.Item label="检索索引">向量索引</Descriptions.Item>
            <Descriptions.Item label="审计日志">审计日志</Descriptions.Item>
          </Descriptions>
        </Card>
        <Card title="数据安全提醒">
          <div className="prototype-notice">客户资料保留在企业本地，上传、解析、检索索引构建均在内网完成。</div>
        </Card>
      </div>
      <Card className="mb-4" title="部署与迁移">
        <Descriptions column={{ xs: 1, lg: 2 }}>
          <Descriptions.Item label="统一入口">http://127.0.0.1:8080</Descriptions.Item>
          <Descriptions.Item label="数据目录">./data</Descriptions.Item>
          <Descriptions.Item label="客户资料">客户机器本地上传、本地建库</Descriptions.Item>
          <Descriptions.Item label="生产镜像"><Tag color="green">客户机器构建或准备对应架构镜像</Tag></Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="健康检查">
        <Timeline
          items={[
            { color: "green", content: "前端 8080 可访问" },
            { color: "green", content: "后端 /health 正常" },
            { color: "blue", content: "Qdrant 内部网络访问" },
            { color: "green", content: "SQLite 可读写" },
            { color: "orange", content: "问答模型已连接本地服务，可切换企业模型服务" },
            { color: "green", content: "评测脚本可输出报告" }
          ]}
        />
        <Typography.Paragraph type="secondary">
          Windows 与 Linux 均提供 health_check 脚本，迁移后生成 health_check_report.json 和 migration_check_report.md。
        </Typography.Paragraph>
      </Card>
    </>
  );
}
