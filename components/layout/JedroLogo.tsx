/** Aspect ratio of the official Jedro+ lockup (public/brand/jedro-logo.svg, copied from the Jedro+ app). */
const ASPECT = 972 / 251

/**
 * The official Jedro+ logo (lettering + gradient plus). With `tagline`,
 * "Davčna blagajna" sits below it in the brand gradient.
 */
export default function JedroLogo({
  height = 30,
  tagline = false,
  inline = false,
  className = '',
}: {
  height?: number
  tagline?: boolean
  /** Put the tagline next to the logo (one row) instead of below it. */
  inline?: boolean
  className?: string
}) {
  return (
    <div className={`inline-flex ${inline ? 'flex-row items-center gap-2.5' : 'flex-col items-start'} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/jedro-logo.svg"
        alt="Jedro+"
        width={Math.round(height * ASPECT)}
        height={height}
        draggable={false}
        className="block select-none"
      />
      {tagline && (
        <p
          className={`brand-gradient-text font-semibold leading-[1.35] tracking-tight ${
            inline ? 'border-l border-gray-200 pl-2.5 text-[13px]' : 'mt-1 text-[12px]'
          }`}
        >
          Davčna blagajna
        </p>
      )}
    </div>
  )
}
