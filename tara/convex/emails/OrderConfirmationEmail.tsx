import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { formatCents } from "../pricing";

export interface OrderConfirmationItem {
  name: string;
  variantLabel: string;
  qty: number;
  unitPriceCents: number;
  batch: string;
  verifyId: string;
}

export function OrderConfirmationEmail({
  orderNo,
  invoiceNo,
  items,
  totalCents,
  siteUrl,
}: {
  orderNo: string;
  invoiceNo: string;
  items: OrderConfirmationItem[];
  totalCents: number;
  siteUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Order {orderNo} confirmed — {formatCents(totalCents)}</Preview>
      <Body style={{ backgroundColor: "#f4f5f3", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            margin: "40px auto",
            padding: "32px",
            borderRadius: "8px",
            maxWidth: "480px",
            border: "1px solid #e5e7eb",
          }}
        >
          <Heading style={{ fontSize: "20px", color: "#111827", margin: "0 0 4px" }}>
            Order confirmed
          </Heading>
          <Text style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 20px" }}>
            {orderNo} · Invoice {invoiceNo}
          </Text>

          {items.map((item) => (
            <Section key={`${item.name}-${item.variantLabel}`} style={{ marginBottom: "12px" }}>
              <Row>
                <Column>
                  <Text style={{ fontSize: "14px", color: "#111827", margin: 0, fontWeight: 600 }}>
                    {item.name} — {item.variantLabel}
                  </Text>
                  <Text style={{ fontSize: "12px", color: "#6b7280", margin: "2px 0 0" }}>
                    Qty {item.qty} · Batch {item.batch} · {item.verifyId}
                  </Text>
                </Column>
                <Column align="right">
                  <Text style={{ fontSize: "14px", color: "#111827", margin: 0 }}>
                    {formatCents(item.unitPriceCents * item.qty)}
                  </Text>
                </Column>
              </Row>
            </Section>
          ))}

          <Hr style={{ borderColor: "#e5e7eb", margin: "16px 0" }} />

          <Row>
            <Column>
              <Text style={{ fontSize: "15px", fontWeight: 700, color: "#111827", margin: 0 }}>
                Total
              </Text>
            </Column>
            <Column align="right">
              <Text style={{ fontSize: "15px", fontWeight: 700, color: "#111827", margin: 0 }}>
                {formatCents(totalCents)}
              </Text>
            </Column>
          </Row>

          <Text style={{ fontSize: "12px", color: "#9ca3af", lineHeight: "18px", marginTop: "24px" }}>
            Every line carries its own batch number and TARA Verify ID — check any item at{" "}
            {siteUrl}/verify. For laboratory research use only. Not for human or veterinary use.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default OrderConfirmationEmail;
