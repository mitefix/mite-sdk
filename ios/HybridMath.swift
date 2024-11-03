import Foundation

class HybridMath: HybridMathSpec {
    public var hybridContext = margelo.nitro.HybridContext()
    public var memorySize: Int {
        return getSizeOf(self)
    }

    public var pi: Double {
        return Double.pi
    }
    public func add(a: Double, b: Double) throws -> Double {
        return a + b
    }
}
