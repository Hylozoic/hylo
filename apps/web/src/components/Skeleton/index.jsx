import React from 'react'
import { cn } from 'util/index'
import classes from './Skeleton.module.scss'

/** Shimmer placeholder block. Apply sizing and shape via `className` (Tailwind). */
export default function Skeleton ({ className }) {
  return <div aria-hidden='true' className={cn(classes.skeleton, className)} />
}
