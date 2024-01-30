import { TypeLensConfiguration } from './typeLensConfiguration'
import * as vscode from 'vscode'

export class AppConfiguration {
    private cachedSettings: TypeLensConfiguration
    constructor() {
        vscode.workspace.onDidChangeConfiguration(_ => {
            this.cachedSettings = null
        })
    }

    get extensionName() {
        return 'typelens'
    }

    public typeLensEnabled: boolean = true

    get settings(): TypeLensConfiguration {
        if (!this.cachedSettings) {
            const settings = vscode.workspace.getConfiguration(this.extensionName)
            this.cachedSettings = new TypeLensConfiguration()
            for (const propertyName in this.cachedSettings) {
                if (settings.has(propertyName)) {
                    this.cachedSettings[propertyName] = settings.get(propertyName)
                }
            }
        }
        return this.cachedSettings
    }
}
