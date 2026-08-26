import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

import { CalculatorApp } from './CalculatorApp';

export default function CalculatorIsland() {
  return (
    <Theme theme={neutralTheme}>
      <CalculatorApp />
    </Theme>
  );
}
