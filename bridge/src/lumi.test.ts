import { describe, it, expect } from "vitest"
import {
  LumiCodec,
  Opcode,
  LumiDecodeError,
  AnimationId,
  PROTO_VERSION,
  MIN_FRAME_SIZE,
  type LumiFrame,
} from "lumi-protocol"

const DEVICE_ID = 0x00ab
const codec = new LumiCodec()

/** CRC-16/CCITT (poly 0x1021, init 0xFFFF) — mirrors lumi-protocol codec. */
function crc16(buf: Buffer, start: number, end: number): number {
  let crc = 0xffff
  for (let i = start; i < end; i++) {
    crc ^= buf[i]! << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) : crc << 1
    }
    crc &= 0xffff
  }
  return crc
}

function withProtocolVersion(buf: Buffer, ver: number): Buffer {
  const copy = Buffer.from(buf)
  copy.writeUInt8(ver, 0)
  const totalLen = copy.readUInt16BE(5)
  copy.writeUInt16BE(crc16(copy, 0, totalLen - 2), totalLen - 2)
  return copy
}

function baseHeader(seq: number): Pick<LumiFrame, "ver" | "deviceId" | "seq" | "totalLen"> {
  return { ver: PROTO_VERSION, deviceId: DEVICE_ID, seq, totalLen: 0 }
}

function roundTrip(frame: LumiFrame) {
  const buf = codec.encode(frame)
  expect(buf.length).toBeGreaterThanOrEqual(MIN_FRAME_SIZE)
  expect(buf.readUInt8(0)).toBe(PROTO_VERSION)
  expect(buf.readUInt16BE(5)).toBe(buf.length)
  const decoded = codec.decode(buf)
  expect(decoded).toEqual({ ...frame, totalLen: buf.length })
}

describe("LumiCodec", () => {
  describe("round-trip encode/decode", () => {
    it("SET_POWER", () => {
      roundTrip({
        ...baseHeader(1),
        opc: Opcode.SET_POWER,
        payload: { state: 0x01 },
      })
      roundTrip({
        ...baseHeader(2),
        opc: Opcode.SET_POWER,
        payload: { state: 0x00 },
      })
    })

    it("SET_BRIGHTNESS", () => {
      roundTrip({
        ...baseHeader(3),
        opc: Opcode.SET_BRIGHTNESS,
        payload: { brightness: 128 },
      })
    })

    it("SET_COLOR", () => {
      roundTrip({
        ...baseHeader(4),
        opc: Opcode.SET_COLOR,
        payload: { h: 32768, s: 200, b: 100 },
      })
    })

    it("SET_ANIMATION", () => {
      roundTrip({
        ...baseHeader(5),
        opc: Opcode.SET_ANIMATION,
        payload: { animId: AnimationId.RAINBOW, speed: 50, intensity: 75 },
      })
    })

    it("STOP_ANIMATION", () => {
      const frame: LumiFrame = {
        ...baseHeader(6),
        opc: Opcode.STOP_ANIMATION,
        payload: {},
      }
      const buf = codec.encode(frame)
      expect(buf.length).toBe(MIN_FRAME_SIZE)
      roundTrip(frame)
    })

    it("SET_ZONE", () => {
      roundTrip({
        ...baseHeader(7),
        opc: Opcode.SET_ZONE,
        payload: { zoneId: 3 },
      })
    })

    it("STATE_REPORT", () => {
      roundTrip({
        ...baseHeader(8),
        opc: Opcode.STATE_REPORT,
        payload: {
          power: 0x01,
          brightness: 200,
          h: 12000,
          s: 180,
          b: 90,
          animId: AnimationId.PULSE,
        },
      })
    })

    it("DISCOVERY_ANNOUNCE", () => {
      roundTrip({
        ...baseHeader(9),
        opc: Opcode.DISCOVERY_ANNOUNCE,
        payload: {
          deviceType: 1,
          capabilities: 0x0f,
          protoVersion: PROTO_VERSION,
          zoneId: 2,
          name: "strip-kitchen",
        },
      })
    })
  })

  describe("error handling", () => {
    it("rejects invalid CRC", () => {
      const buf = codec.encode({
        ...baseHeader(1),
        opc: Opcode.SET_POWER,
        payload: { state: 0x01 },
      })
      buf[buf.length - 1] ^= 0xff
      expect(() => codec.decode(buf)).toThrow(LumiDecodeError)
    })

    it("rejects buffer too short", () => {
      const short = Buffer.alloc(MIN_FRAME_SIZE - 1)
      expect(() => codec.decode(short)).toThrow(LumiDecodeError)
    })

    it("rejects wrong protocol version", () => {
      const buf = codec.encode({
        ...baseHeader(1),
        opc: Opcode.SET_POWER,
        payload: { state: 0x01 },
      })
      expect(() => codec.decode(withProtocolVersion(buf, 99))).toThrow(LumiDecodeError)
    })
  })

  describe("SEQ counter", () => {
    /** Mirrors LumiClient.nextSeq — codec is stateless; client owns the counter. */
    function nextSeq(seq: number): number {
      return (seq + 1) & 0xff
    }

    it("wraps 255 → 0 across successive frames", () => {
      let seq = 254
      seq = nextSeq(seq)
      expect(seq).toBe(255)

      const at255 = codec.encode({
        ...baseHeader(seq),
        opc: Opcode.SET_POWER,
        payload: { state: 0x01 },
      })
      expect(codec.decode(at255).seq).toBe(255)

      seq = nextSeq(seq)
      expect(seq).toBe(0)

      const at0 = codec.encode({
        ...baseHeader(seq),
        opc: Opcode.SET_POWER,
        payload: { state: 0x00 },
      })
      expect(codec.decode(at0).seq).toBe(0)
    })
  })
})
