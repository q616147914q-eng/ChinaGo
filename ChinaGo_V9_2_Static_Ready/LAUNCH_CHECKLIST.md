# ChinaGo 商业化上线清单

## 产品闭环
- AI 行程规划
- AI 中国旅行助手
- 实时信息搜索
- 城市/景点/生存指南
- Local Experiences 体验入口
- Saved Trips
- Supabase Auth / Postgres / RLS
- 酒店/门票/高铁/地图 Provider Adapter
- Offer/商业库存数据结构
- 内容纠错机制
- AI/live-search 基础限流
- Docker / Render 部署

## 首批收入来源
1. 酒店联盟佣金
2. 景区门票佣金
3. 接送机
4. 英文导游
5. 私人司机/包车
6. Kung Fu / 食物 / 摄影等当地体验
7. 高端定制旅行服务

## 上线前必须完成
- [ ] 配置 OpenAI API Key
- [ ] 创建 Supabase 项目并执行 schema.sql + seed.sql
- [ ] 接入至少一个真实酒店/票务合作方
- [ ] 接入至少一个本地体验供应方
- [ ] 配置域名、隐私政策、Terms
- [ ] 配置错误监控和日志
- [ ] 人工审核所有商业链接
- [ ] 测试海外网络、手机浏览器、登录、支付跳转
- [ ] 做英文 SEO 页面


## V5 commercial checklist
- [ ] Run `supabase/v5_migration.sql`
- [ ] Set `ADMIN_EMAILS`
- [ ] Configure at least one real hotel/ticket/transfer/experience provider
- [ ] Verify provider terms allow affiliate/lead traffic
- [ ] Replace demo `#` booking links
- [ ] Test booking click telemetry
- [ ] Submit a test booking lead and move it through the admin dashboard
- [ ] Verify provider failure handling and fallback lead capture
