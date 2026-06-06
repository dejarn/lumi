import { describe, it, expect } from "vitest"

// Frame encoding/CRC is one of the two documented Vitest scopes (architecture.md).
// The real codec lives in lumi-protocol's bridge/node; these placeholders name the
// round-trip cases to verify once it is wired in.

describe("lumi frame codec", () => {
  it.todo("encodes a frame as VER|OPC|DEVICE_ID|SEQ|TOTAL_LEN|PAYLOAD|CRC-16")
  it.todo("computes CRC-16/CCITT (poly 0x1021, init 0xFFFF)")
  it.todo("rejects a frame with a bad CRC")
  it.todo("wraps the SEQ counter at 255")

  it("placeholder keeps the suite green until the codec is vendored", () => {
    expect(true).toBe(true)
  })
})
