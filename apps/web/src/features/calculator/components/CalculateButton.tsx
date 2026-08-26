import { useId } from 'react';

import { Button } from '@astryxdesign/core/Button';

interface Props {
  disabled: boolean;
  onCalculate: () => void;
}

export function CalculateButton({ disabled, onCalculate }: Props) {
  const helpId = useId();
  const help = disabled
    ? '상품 데이터와 매수일·매수가·수량의 오류를 모두 확인해 주세요.'
    : '입력값은 이 브라우저 안에서만 계산됩니다.';

  return (
    <div className="calculate-button-wrap">
      <Button
        label="계산하기"
        variant="primary"
        isDisabled={disabled}
        onClick={onCalculate}
        aria-describedby={helpId}
        {...(disabled ? { tooltip: help } : {})}
      />
      <p id={helpId} className="calculate-help">
        {help}
      </p>
    </div>
  );
}
