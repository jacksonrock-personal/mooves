'use client'

// Phase 19 — a QR code we only ever DISPLAY.
//
// Mooves never scans: the code encodes a plain URL and the phone's own camera
// opens it. That is deliberate, not a shortcut — iOS Safari has no
// BarcodeDetector, so an in-app scanner would need a camera permission, a JS
// decoding library, and a workaround for getUserMedia in standalone PWAs. None
// of that buys anything the native camera doesn't already do.

import { QRCodeSVG } from 'qrcode.react'

interface QrCodeProps {
  value: string
  size?: number
  /** Accessible description, e.g. "Code to join". */
  label: string
}

export default function QrCode({ value, size = 176, label }: QrCodeProps) {
  return (
    <div className="bg-white rounded-xl p-2.5" role="img" aria-label={label}>
      <QRCodeSVG
        value={value}
        size={size}
        // ink-900 on white. Near-black keeps it on-brand without costing contrast,
        // which is what scanning actually depends on.
        fgColor="#1C1730"
        bgColor="#FFFFFF"
        // Medium recovery: readable at an angle across a table, without the
        // density that makes a code fussy on a small screen.
        level="M"
        marginSize={0}
      />
    </div>
  )
}
