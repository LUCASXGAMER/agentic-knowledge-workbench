import { Card, Descriptions, Form, Input, Select, Switch, Tag } from "antd";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useApiData } from "../hooks/useApiData";

export function ModelsPage() {
  const { data } = useApiData(async () => (await api.get("/settings/model")).data, {
    deploy_profile: "dev-local-mac",
    llm_provider: "mock",
    llm_base_url: "http://host.docker.internal:11434/v1",
    llm_model: "qwen-dev",
    embedding_model_name: "bge-small-zh",
    vector_store_provider: "sqlite",
    qdrant_url: "http://qdrant:6333",
    qdrant_collection: "enterprise_documents",
    enable_reranker: false,
    enable_web_search: false,
    max_concurrent_llm_requests: 1
  });
  const providerLabels: Record<string, string> = {
    mock: "本地问答服务",
    ollama: "本机模型服务",
    vllm: "GPU 模型服务",
    openai_compatible: "企业模型接口"
  };
  return (
    <>
      <PageHeader title="模型配置页" description="统一管理问答模型、向量模型、重排模型和联网能力。" />
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="min-h-[142px]"><h3 className="mb-3 font-black">问答模型服务</h3><p>企业模型服务</p><Tag color="blue">内网部署</Tag></Card>
        <Card className="min-h-[142px]"><h3 className="mb-3 font-black">企业问答模型</h3><p>统一模型接口</p><Tag color="green">正式使用环境</Tag></Card>
        <Card className="min-h-[142px]"><h3 className="mb-3 font-black">向量模型</h3><p>当前向量模型 / 高精度向量模型</p><Tag color="gold">更换需重建</Tag></Card>
        <Card className="min-h-[142px]"><h3 className="mb-3 font-black">重排模型</h3><p>可按需启用</p><Tag color="cyan">需重新评测</Tag></Card>
      </div>
      <Card className="mb-4" title="当前运行模式">
        <Descriptions column={{ xs: 1, md: 2, xl: 3 }}>
          <Descriptions.Item label="当前模式"><Tag color="blue">{data.deploy_profile === "dev-local-mac" ? "本地部署" : data.deploy_profile}</Tag></Descriptions.Item>
          <Descriptions.Item label="正式环境"><Tag color="green">企业模型服务</Tag></Descriptions.Item>
          <Descriptions.Item label="入口端口">8080</Descriptions.Item>
          <Descriptions.Item label="问答服务">{providerLabels[data.llm_provider] || data.llm_provider}</Descriptions.Item>
          <Descriptions.Item label="模型名称">{data.llm_model}</Descriptions.Item>
          <Descriptions.Item label="资料索引模型">{data.embedding_model_name}</Descriptions.Item>
          <Descriptions.Item label="向量库">{data.vector_store_provider === "qdrant" ? "Qdrant" : "本地轻量索引"}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="配置预览">
        <Form layout="vertical" key={data.llm_provider} initialValues={{ provider: data.llm_provider, reranker: data.enable_reranker, web: data.enable_web_search }}>
          <Form.Item label="问答服务类型" name="provider"><Select disabled options={["mock", "ollama", "vllm", "openai_compatible"].map((value) => ({ value, label: providerLabels[value] }))} /></Form.Item>
          <Form.Item label="服务地址"><Input readOnly value={data.llm_base_url} /></Form.Item>
          <Form.Item label="模型名称"><Input readOnly value={data.llm_model} /></Form.Item>
          <Form.Item label="向量库地址"><Input readOnly value={data.vector_store_provider === "qdrant" ? data.qdrant_url : "本地轻量索引"} /></Form.Item>
          <Form.Item label="向量集合"><Input readOnly value={data.qdrant_collection} /></Form.Item>
          <Form.Item label="最大并发问答"><Input readOnly value={data.max_concurrent_llm_requests} /></Form.Item>
          <Form.Item label="启用结果重排" name="reranker" valuePropName="checked"><Switch disabled /></Form.Item>
          <Form.Item label="启用联网搜索" name="web" valuePropName="checked"><Switch disabled /></Form.Item>
        </Form>
      </Card>
    </>
  );
}
