"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

export function NavigationProgress() {
  const pathname = usePathname()
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const prevPathname = useRef(pathname)
  const animTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      clearTimeout(animTimer.current)
      clearTimeout(hideTimer.current)
      setWidth(100)
      hideTimer.current = setTimeout(() => {
        setVisible(false)
        setWidth(0)
      }, 350)
    }
  }, [pathname])

  useEffect(() => {
    function onLinkClick(event: MouseEvent) {
      const anchor = (event.target as Element).closest("a")
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("mailto:")) return
      if (href.startsWith("http") || href.startsWith("//")) return
      if (href === pathname) return

      clearTimeout(animTimer.current)
      clearTimeout(hideTimer.current)
      setVisible(true)
      setWidth(25)
      animTimer.current = setTimeout(() => setWidth(65), 120)
      animTimer.current = setTimeout(() => setWidth(80), 800)
    }

    document.addEventListener("click", onLinkClick)
    return () => {
      document.removeEventListener("click", onLinkClick)
      clearTimeout(animTimer.current)
      clearTimeout(hideTimer.current)
    }
  }, [pathname])

  if (!visible && width === 0) return null

  const transitionStyle =
    width === 0
      ? "none"
      : width === 100
        ? "width 200ms ease-out, opacity 150ms ease-out"
        : "width 400ms ease-out"

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999] h-0.5 bg-primary shadow-[0_0_6px_0px] shadow-primary"
      style={{
        width: `${width}%`,
        opacity: visible ? 1 : 0,
        transition: transitionStyle,
      }}
    />
  )
}
