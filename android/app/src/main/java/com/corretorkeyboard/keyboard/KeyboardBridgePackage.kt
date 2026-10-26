package com.corretorkeyboard.keyboard

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registre em MainApplication.kt:
 *
 *   override fun getPackages(): List<ReactPackage> =
 *       PackageList(this).packages.apply {
 *           add(KeyboardBridgePackage())
 *       }
 */
class KeyboardBridgePackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
        listOf(KeyboardBridgeModule(ctx), AudioRecorderModule(ctx), TranslatorModule(ctx))

    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
