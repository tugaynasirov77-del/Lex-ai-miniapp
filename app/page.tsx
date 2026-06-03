import AppFlow from "../components/AppFlow";
import { FlowProvider } from "../flow";

export default function HomePage() {
  return (
    <FlowProvider>
      <AppFlow />
    </FlowProvider>
  );
}
