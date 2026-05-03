import { parsePaymentMessage } from '../lib/parser';

const cases: Array<{ name: string; msg: string; expectAmount: number; expectType: string }> = [
  {
    name: '原始截图: 微信赞赏到账',
    msg: 'com.tencent.mm\n[2条]微信支付: 二维码赞赏到账0.01元\n微信支付\nUID：99910589\n2026-05-03 13:43:54',
    expectAmount: 0.01,
    expectType: 'appreciation',
  },
  {
    name: '微信收款',
    msg: '微信支付收款100元 UID：12345',
    expectAmount: 100,
    expectType: 'normal',
  },
  {
    name: '支付宝转账到账',
    msg: '支付宝通知: 转账到账50.50元，已转入余额',
    expectAmount: 50.5,
    expectType: 'transfer',
  },
  {
    name: '微信红包到账',
    msg: 'com.tencent.mm 微信红包到账8.88元',
    expectAmount: 8.88,
    expectType: 'redpacket',
  },
  {
    name: '已收款x元',
    msg: '微信支付: 已收款 200.00 元',
    expectAmount: 200,
    expectType: 'normal',
  },
  {
    name: '订单号优先',
    msg: '收款100元 订单号：ORDER12345',
    expectAmount: 100,
    expectType: 'normal',
  },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const r = parsePaymentMessage(c.msg);
  const okAmount = r?.amount === c.expectAmount;
  const okType = r?.paymentType === c.expectType;
  const status = okAmount && okType ? '✅' : '❌';
  console.log(`${status} ${c.name}`);
  console.log(`   amount=${r?.amount} (expect ${c.expectAmount}) | type=${r?.paymentType} (expect ${c.expectType}) | uid=${r?.uid} | needsMatching=${r?.needsMatching}`);
  if (okAmount && okType) pass++; else fail++;
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
