// Foreground cutout using the macOS Vision framework (no third-party deps).
// usage: swift tools/cutout.swift <out-dir> <image> [image ...]
// Writes <out-dir>/<basename>.png with the background erased to transparency.

import Foundation
import Vision
import CoreImage
import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write("usage: cutout.swift <out-dir> <image> [image ...]\n".data(using: .utf8)!)
    exit(2)
}

let outDir = URL(fileURLWithPath: args[1], isDirectory: true)
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)
let ciContext = CIContext()
var failures = 0

for path in args.dropFirst(2) {
    let url = URL(fileURLWithPath: path)
    guard let raw = CIImage(contentsOf: url) else {
        print("skip\t\(path)\tunreadable")
        failures += 1
        continue
    }

    // Phone photos carry their rotation in EXIF; bake it in so the cutout is
    // upright the way the photo looks in Preview.
    let exif = (raw.properties[kCGImagePropertyOrientation as String] as? Int32) ?? 1
    let source = raw.oriented(forExifOrientation: exif)

    let handler = VNImageRequestHandler(ciImage: source, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()

    do {
        try handler.perform([request])
        guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
            print("skip\t\(path)\tno subject found")
            failures += 1
            continue
        }

        let buffer = try observation.generateMaskedImage(
            ofInstances: observation.allInstances,
            from: handler,
            croppedToInstancesExtent: true
        )
        let masked = CIImage(cvPixelBuffer: buffer)
        let name = url.deletingPathExtension().lastPathComponent + ".png"
        let outURL = outDir.appendingPathComponent(name)
        try ciContext.writePNGRepresentation(
            of: masked,
            to: outURL,
            format: .RGBA8,
            colorSpace: CGColorSpaceCreateDeviceRGB()
        )
        print("ok\t\(path)\t\(outURL.path)")
    } catch {
        print("skip\t\(path)\t\(error.localizedDescription)")
        failures += 1
    }
}

exit(failures > 0 && failures == args.count - 2 ? 1 : 0)
