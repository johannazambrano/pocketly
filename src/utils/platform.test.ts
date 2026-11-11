import { describe, expect, it } from 'vitest'
import { detectPlatform } from './platform'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

describe('detectPlatform', () => {
  it('riconosce iPhone, Android e PC', () => {
    expect(detectPlatform({ userAgent: IPHONE, maxTouchPoints: 5 })).toBe('ios')
    expect(detectPlatform({ userAgent: ANDROID, maxTouchPoints: 5 })).toBe('android')
    expect(detectPlatform({ userAgent: WINDOWS })).toBe('desktop')
  })

  it('un iPad che si presenta come Mac è iOS, un Mac vero è PC', () => {
    expect(detectPlatform({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5 })).toBe('ios')
    expect(detectPlatform({ userAgent: IPAD_AS_MAC, maxTouchPoints: 0 })).toBe('desktop')
  })
})
