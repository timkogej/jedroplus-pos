'use client'
import { forwardRef, useId } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const autoId = useId()
    const inputId = id ?? autoId
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
    return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        ref={ref}
        className={`
          w-full px-3.5 py-2.5 rounded-lg border bg-white text-sm text-gray-900
          placeholder:text-gray-400 transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900
          ${error ? 'border-red-300 focus:border-red-400 focus:ring-red-500/10' : 'border-gray-200'}
          ${className}
        `}
        {...props}
      />
      {error && <p id={`${inputId}-error`} role="alert" className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p id={`${inputId}-hint`} className="text-xs text-gray-400">{hint}</p>}
    </div>
    )
  }
)
Input.displayName = 'Input'
export default Input
