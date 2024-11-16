// TODO: Export all HybridObjects here

import { NitroModules } from "react-native-nitro-modules";
export * from "./specs/BugzzAppSDK.nitro";
import type { BugzzAppSDK } from "./specs/BugzzAppSDK.nitro";
import { BugzzApp } from "./BugzzApp";

export const bugzzApp = NitroModules.createHybridObject<BugzzAppSDK>("BugzzAppSDK")
console.log('NITRO MODULE->', bugzzApp.hello)

export { BugzzApp }
