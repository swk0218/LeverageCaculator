# Calculation Specification

Core formulas and date policies are implemented in `packages/calculation-core` as pure TypeScript. No UI component owns financial math.

- Cost: sum of purchase price times quantity.
- Average price: total cost divided by total quantity.
- Actual return: current product value divided by total cost minus one.
- Product break-even: average purchase price divided by current product price minus one.
- Simple theory per lot: leverage times the underlying period return.
- Daily theory per lot: product of each `1 + leverage × daily underlying return`, minus one.
- Compounding effect: daily theoretical P/L minus simple theoretical P/L.
- Actual gap: official analysis-date product P/L minus daily theoretical P/L.

Dates are timezone-free `YYYY-MM-DD` values. Missing purchase-date prices are not substituted. The analysis date is the latest date common to product and underlying series. Lots after that date remain in actual P/L but are excluded from theory with an explicit partial-analysis warning.
