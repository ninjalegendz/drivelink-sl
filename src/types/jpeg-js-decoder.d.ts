declare module "jpeg-js/lib/decoder" {
  interface DecodedJpeg {
    width: number;
    height: number;
    data: Uint8Array;
    comments?: string[];
  }

  interface DecodeOptions {
    useTArray: true;
    colorTransform?: boolean;
    formatAsRGBA?: boolean;
    tolerantDecoding?: boolean;
    maxResolutionInMP?: number;
    maxMemoryUsageInMB?: number;
  }

  export default function decode(data: Uint8Array, options: DecodeOptions): DecodedJpeg;
}

declare module "jpeg-js/lib/encoder" {
  interface RawImageData {
    width: number;
    height: number;
    data: Uint8Array;
  }

  export default function encode(data: RawImageData, quality?: number): {
    data: Uint8Array;
    width: number;
    height: number;
  };
}
