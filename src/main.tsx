import { render } from "preact";
import App from "./App";
import { I18nProvider } from "./i18n";

render(
  <I18nProvider>
    <App />
  </I18nProvider>,
  document.getElementById("root")!,
);
