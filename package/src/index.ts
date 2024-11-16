// TODO: Export all HybridObjects here

import { NitroModules } from "react-native-nitro-modules";
export * from "./specs/BugzzAppSDK.nitro";
import type { BugzzAppSDK as BugzzAppSDKType } from "./specs/BugzzAppSDK.nitro";
import { BugzzApp } from "./BugzzApp";

export const BugzzAppSDK = NitroModules.createHybridObject<BugzzAppSDKType>("BugzzAppSDK")

export { BugzzApp }
export * from './types'
