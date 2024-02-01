import { TSCodeLensProvider } from './tsCodeLensProvider'
import * as vscode from 'vscode'
import { OutputChannel, commands } from 'vscode'
export class Application {
    private _output: OutputChannel = undefined
    readonly provider = new TSCodeLensProvider()
    private get output() {
        if (this._output === undefined) {
            this._output = vscode.window.createOutputChannel('typelens')
            this._output.show()
        }
        return this._output
    }
    async logUnused() {
        if (!this.provider.config.typeLensEnabled) return
        if (!vscode.window.activeTextEditor) return
        const document = vscode.window.activeTextEditor.document
        const methodReferences = await this.provider.provideCodeLenses(document)

        this.output.clear()
        this.output.appendLine('Unused symbols:')
        this.output.appendLine(document.fileName)
        let isUnusedSymbolsExist = false
        for (const symbol of methodReferences) {
            const filteredLocation = await this.provider.getFilteredLocations(symbol)
            const nonBlackBoxedLocations = this.provider.getNonBlackBoxedLocations(filteredLocation)
            if (nonBlackBoxedLocations.length === 0) {
                isUnusedSymbolsExist = true
                this.output.appendLine(this.provider.formatMessageForOutput(document, symbol))
            }
        }
        if (!isUnusedSymbolsExist) this.output.appendLine('Not found')
    }

    private async triggerCodeLensComputation() {
        if (!vscode.window.activeTextEditor) return
        const end = vscode.window.activeTextEditor.selection.end
        await vscode.window.activeTextEditor.edit(editbuilder => {
            editbuilder.insert(end, ' ')
        })
        await commands.executeCommand('undo')
    }

    async toggleTypelens() {
        this.provider.config.typeLensEnabled = !this.provider.config.typeLensEnabled
        await this.triggerCodeLensComputation()
    }
}
