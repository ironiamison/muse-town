import { Check, CircleDollarSign, CreditCard, Sparkles } from "lucide-react";

export type PaymentFlowState = "need" | "quote" | "paying" | "executing" | "complete";

const steps: PaymentFlowState[] = ["need", "quote", "paying", "executing", "complete"];

export default function PaymentFlow({
  state,
  need,
  amount,
  currency,
  service,
  duration,
  illustrative = false,
}: {
  state: PaymentFlowState;
  need: string;
  amount: number | null;
  currency: string;
  service: string;
  duration?: string;
  illustrative?: boolean;
}) {
  const activeIndex = steps.indexOf(state);
  return (
    <div className={`payment-flow is-${state}`}>
      <header>
        <span><i /> {illustrative ? "Illustrative protocol flow" : "Payment activity"}</span>
        <small>{illustrative ? "No payment is being executed" : "Machine commerce"}</small>
      </header>
      <div className="payment-flow__route">
        <div className="payment-flow__node">
          <Sparkles />
          <span><small>Muse needs</small><strong>{need}</strong></span>
        </div>
        <i className={activeIndex >= 1 ? "active" : ""}><b /></i>
        <div className="payment-flow__price">
          <small>Price</small>
          <strong>{amount === null ? "Quote required" : `${amount} ${currency}`}</strong>
        </div>
        <i className={activeIndex >= 2 ? "active" : ""}><b /></i>
        <div className="payment-flow__node">
          <CircleDollarSign />
          <span><small>Payment</small><strong>x402</strong></span>
        </div>
        <i className={activeIndex >= 3 ? "active" : ""}><b /></i>
        <div className="payment-flow__node">
          <CreditCard />
          <span><small>Paid resource</small><strong>{service}</strong></span>
        </div>
        <i className={activeIndex >= 4 ? "active" : ""}><b /></i>
        <div className={`payment-flow__result ${state === "complete" ? "active" : ""}`}>
          <Check />
          <span><small>Result</small><strong>{state === "complete" ? "Returned" : "Pending"}</strong>{duration && <em>{duration}</em>}</span>
        </div>
      </div>
      <footer>
        {steps.map((step, index) => (
          <span className={index <= activeIndex ? "active" : ""} key={step}>{step}</span>
        ))}
      </footer>
    </div>
  );
}
