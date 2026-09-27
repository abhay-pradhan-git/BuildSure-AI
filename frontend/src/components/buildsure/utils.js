// Simple class-name joiner (clsx-lite). Filters out falsy values so you
// can write: cn('base', condition && 'extra-class')
export function cn(...args) {
  return args.filter(Boolean).join(' ')
}
