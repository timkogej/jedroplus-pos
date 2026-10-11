'use client'
import { forwardRef, useEffect, useState } from 'react'
import Input from '@/components/ui/Input'
import { decimalPattern, formatDecimal as format, parseDecimal as parse } from '@/lib/decimal'

type InputProps = React.ComponentProps<typeof Input>

interface DecimalInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type' | 'inputMode'> {
  /** The numeric value (0 when the field is empty). */
  value: number
  onValueChange: (value: number) => void
  /** Allowed digits after the separator. */
  decimals?: number
  /** When the field is left empty or 0, jump to this value (e.g. quantity → 1). Other values stay. */
  emptyAs?: number
}

/**
 * A number field for amounts and quantities that behaves the way people type:
 * the field can be emptied while typing, "0,5" and "0.5" both work (comma or dot),
 * and the phone shows the decimal keypad. Text inside is a string; outside it is
 * a plain number, so totals are computed exactly as before.
 */
const DecimalInput = forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ value, onValueChange, decimals = 2, emptyAs, onBlur, ...rest }, ref) => {
    const [text, setText] = useState(() => format(value))

    // If the number is changed from outside (not by typing here), show it.
    useEffect(() => {
      if (parse(text) !== value) setText(format(value))
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value])

    const allowed = decimalPattern(decimals)

    return (
      <Input
        {...rest}
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          const raw = e.target.value
          if (!allowed.test(raw)) return
          setText(raw)
          onValueChange(parse(raw))
        }}
        onBlur={(e) => {
          let n = parse(text)
          if (emptyAs !== undefined && n <= 0) {
            n = emptyAs
            onValueChange(n)
          }
          setText(format(n))
          onBlur?.(e)
        }}
      />
    )
  }
)
DecimalInput.displayName = 'DecimalInput'
export default DecimalInput
