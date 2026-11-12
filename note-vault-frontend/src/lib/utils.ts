import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function parseInterests(value: string): string[] {
  return value
    .split(',')
    .map((interest) => interest.trim())
    .filter(Boolean)
}

export function formatInterests(interests: string[]): string {
  return interests.join(', ')
}

export function getOwnerId(owner: string | { _id: string }): string {
  return typeof owner === 'string' ? owner : owner._id
}
