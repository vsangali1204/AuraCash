import { Document, Page, View, Text, StyleSheet, pdf } from '@react-pdf/renderer';
import type { Transaction } from '@/types';
import { formatCurrency, formatDate, PAYMENT_METHOD_LABELS } from '@/lib/utils';

export interface DebtorGroup {
  name: string;
  transactions: Transaction[];
}

export interface CategoryTotal {
  name: string;
  color: string;
  amount: number;
}

export interface ReportDocProps {
  debtors: DebtorGroup[];
  categoryTotals: CategoryTotal[];
  generatedAt: string;
  totalGrand: number;
  periodLabel: string;
}

const BAR_MAX = 245;

const s = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 40,
    paddingTop: 36,
    paddingBottom: 60,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1e293b',
  },

  // ── Header ──────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 22,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#f59e0b',
  },
  appName: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  reportSub: { fontSize: 9, color: '#6b7280', marginTop: 3 },
  hRight: { alignItems: 'flex-end' },
  hDate: { fontSize: 7.5, color: '#9ca3af' },
  hTotalLabel: { fontSize: 7.5, color: '#6b7280', marginTop: 7 },
  hTotal: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#f59e0b', marginTop: 1 },

  // ── Debtor section ───────────────────────────────────────────────────
  section: { marginBottom: 18 },

  dHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  avatarText: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  dName: { flex: 1, fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  dMeta: { fontSize: 7.5, color: '#94a3b8', marginRight: 12 },
  dPending: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#f59e0b' },

  // ── Table ────────────────────────────────────────────────────────────
  table: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  thead: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8' },
  trow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  trowAlt: { backgroundColor: '#fafafa' },
  trowPartial: { backgroundColor: '#fffbeb' },
  trowRemainder: { backgroundColor: '#eef2ff' },
  td: { fontSize: 8, color: '#334155' },
  tdBold: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1e293b' },
  tdSub: { fontSize: 7, color: '#94a3b8', marginTop: 1 },

  // Columns
  cDate: { width: 58 },
  cDesc: { flex: 1, paddingRight: 6 },
  cMethod: { width: 82 },
  cAmount: { width: 85 },
  cStatus: { width: 62 },

  // Badges
  bPartial: {
    backgroundColor: '#fed7aa',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  bPartialText: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#c2410c' },
  bPending: {
    backgroundColor: '#fef3c7',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  bPendingText: { fontSize: 6.5, color: '#92400e' },
  bRemainder: {
    backgroundColor: '#e0e7ff',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  bRemainderText: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#3730a3' },

  // Subtotal
  stRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  stLabel: { flex: 1, fontSize: 7.5, color: '#6b7280' },
  stAmount: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#f59e0b' },

  // ── Category chart ───────────────────────────────────────────────────
  chartSection: { marginTop: 24 },
  chartTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  chartRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  chartLabel: { width: 115, fontSize: 8, color: '#334155' },
  barBg: {
    width: BAR_MAX,
    height: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 5,
    marginRight: 10,
  },
  barFill: { height: 10, borderRadius: 5 },
  chartVal: { flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1e293b', textAlign: 'right' },

  // ── Footer ───────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: '#9ca3af' },
});

function ReportDoc({ debtors, categoryTotals, generatedAt, totalGrand, periodLabel }: ReportDocProps) {
  const maxCat = Math.max(...categoryTotals.map((c) => c.amount), 1);

  return (
    <Document title="Relatório de Recebíveis" author="AuraCash">
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.appName}>AuraCash</Text>
            <Text style={s.reportSub}>Relatório de Valores a Receber — {periodLabel}</Text>
          </View>
          <View style={s.hRight}>
            <Text style={s.hDate}>Gerado em {generatedAt}</Text>
            <Text style={s.hTotalLabel}>Total pendente selecionado</Text>
            <Text style={s.hTotal}>{formatCurrency(totalGrand)}</Text>
          </View>
        </View>

        {/* ── Debtor sections ── */}
        {debtors.map((debtor) => {
          const pending = debtor.transactions.reduce((sum, t) => sum + t.remainingAmount, 0);
          const total = debtor.transactions.reduce((sum, t) => sum + t.amount, 0);
          const received = total - pending;

          return (
            <View key={debtor.name} style={s.section}>
              {/* Section header */}
              <View style={s.dHeader}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{debtor.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={s.dName}>{debtor.name}</Text>
                <Text style={s.dMeta}>{debtor.transactions.length} lançamento(s)</Text>
                <Text style={s.dPending}>{formatCurrency(pending)}</Text>
              </View>

              {/* Table */}
              <View style={s.table}>
                {/* Header row */}
                <View style={s.thead}>
                  <Text style={[s.th, s.cDate]}>Data</Text>
                  <Text style={[s.th, s.cDesc]}>Descrição</Text>
                  <Text style={[s.th, s.cMethod]}>Forma Pgto</Text>
                  <Text style={[s.th, s.cAmount]}>Valor</Text>
                  <Text style={[s.th, s.cStatus]}>Status</Text>
                </View>

                {/* Transaction rows */}
                {debtor.transactions.map((tx, i) => {
                  const isPartial = tx.receiptStatus === 'partial';
                  const isRemainder = !!tx.isPartialRemainder;
                  return (
                    <View
                      key={tx.id}
                      style={[
                        s.trow,
                        ...(isRemainder ? [s.trowRemainder] : i % 2 === 1 ? [s.trowAlt] : []),
                        ...(isPartial ? [s.trowPartial] : []),
                      ]}
                    >
                      <Text style={[s.td, s.cDate]}>{formatDate(tx.date)}</Text>
                      <View style={s.cDesc}>
                        <Text style={s.td}>{tx.description}</Text>
                        {tx.category && (
                          <Text style={s.tdSub}>{tx.category.name}</Text>
                        )}
                        {isRemainder && (
                          <Text style={[s.tdSub, { color: '#3730a3' }]}>↩ saldo de pgto parcial</Text>
                        )}
                      </View>
                      <Text style={[s.td, s.cMethod]}>
                        {PAYMENT_METHOD_LABELS[tx.paymentMethod] ?? tx.paymentMethod}
                      </Text>
                      <View style={s.cAmount}>
                        <Text style={[s.tdBold, { textAlign: 'right' }]}>
                          {formatCurrency(tx.remainingAmount)}
                        </Text>
                        {tx.receivedAmount > 0 && (
                          <Text style={[s.tdSub, { textAlign: 'right' }]}>
                            +{formatCurrency(tx.receivedAmount)} receb.
                          </Text>
                        )}
                      </View>
                      <View style={[s.cStatus, { alignItems: 'flex-start' }]}>
                        {isRemainder ? (
                          <View style={s.bRemainder}>
                            <Text style={s.bRemainderText}>SALDO</Text>
                          </View>
                        ) : isPartial ? (
                          <View style={s.bPartial}>
                            <Text style={s.bPartialText}>PARCIAL</Text>
                          </View>
                        ) : (
                          <View style={s.bPending}>
                            <Text style={s.bPendingText}>PENDENTE</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}

                {/* Subtotal row */}
                <View style={s.stRow}>
                  <Text style={s.stLabel}>
                    {'Total: ' + formatCurrency(total) + '  ·  Pendente: ' + formatCurrency(pending) +
                      (received > 0 ? '  ·  Recebido: ' + formatCurrency(received) : '')}
                  </Text>
                  <Text style={s.stAmount}>{formatCurrency(pending)}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* ── Category chart ── */}
        {categoryTotals.length > 0 && (
          <View style={s.chartSection}>
            <Text style={s.chartTitle}>Resumo por Categoria</Text>
            {categoryTotals.map((cat) => (
              <View key={cat.name} style={s.chartRow}>
                <View style={[s.dot, { backgroundColor: cat.color || '#f59e0b' }]} />
                <Text style={s.chartLabel}>{cat.name}</Text>
                <View style={s.barBg}>
                  <View
                    style={[
                      s.barFill,
                      {
                        width: (cat.amount / maxCat) * BAR_MAX,
                        backgroundColor: cat.color || '#f59e0b',
                      },
                    ]}
                  />
                </View>
                <Text style={s.chartVal}>{formatCurrency(cat.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Footer (fixed on every page) ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>AuraCash — Relatório de Recebíveis</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function downloadReceivablesPDF(props: ReportDocProps): Promise<void> {
  const blob = await pdf(<ReportDoc {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recebiveis-${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default ReportDoc;
