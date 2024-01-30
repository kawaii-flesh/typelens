'use strict'
import * as vscode from 'vscode'
import { commands, TextDocument, SymbolKind } from 'vscode'
import { MethodReferenceLens, TSCodeLensProvider } from './tsCodeLensProvider'

async function triggerCodeLensComputation() {
    if (!vscode.window.activeTextEditor) return
    const end = vscode.window.activeTextEditor.selection.end
    await vscode.window.activeTextEditor.edit(editbuilder => {
        editbuilder.insert(end, ' ')
    })
    await commands.executeCommand('undo')
}

async function logUnused(provider: TSCodeLensProvider) {
    function formatMessage(document: TextDocument, symbol: MethodReferenceLens) {
        const positionStart = symbol.range.start
        return `${SymbolKind[symbol.kind]}: "${symbol.name}" ${document.fileName}:${positionStart.line + 1}:${positionStart.character + 1}`
    }
    if (!vscode.window.activeTextEditor) return
    const output = vscode.window.createOutputChannel('typelens')
    const document = vscode.window.activeTextEditor.document
    const symbolsReferences = await provider.getSymbolsReferences(document)
    const methodReferences = provider.getMethodReferenceLens(symbolsReferences, document)

    output.appendLine('Unused symbols:')
    let isUnusedSymbolsExist = false
    for (const symbol of methodReferences) {
        const filteredLocation = await provider.getFilteredLocations(symbol)
        const nonBlackBoxedLocations = provider.getNonBlackBoxedLocations(filteredLocation)
        if (nonBlackBoxedLocations.length === 0) {
            isUnusedSymbolsExist = true
            output.appendLine(formatMessage(document, symbol))
        }
    }
    if (!isUnusedSymbolsExist) output.appendLine('Not found')
    output.show()
}

function setUpCommands(disposables: vscode.Disposable[], provider: TSCodeLensProvider) {
    disposables.push(
        commands.registerCommand('typelens.toggle', async () => {
            provider.config.typeLensEnabled = !provider.config.typeLensEnabled
            await triggerCodeLensComputation()
        }),
    )
    disposables.push(
        commands.registerCommand('typelens.unused', async () => {
            await logUnused(provider)
        }),
    )
}

export function activate(context: vscode.ExtensionContext) {
    const provider = new TSCodeLensProvider()
    const disposables: vscode.Disposable[] = context.subscriptions
    setUpCommands(disposables, provider)
    disposables.push(vscode.languages.registerCodeLensProvider(['*'], provider))
    disposables.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                provider.updateDecorations(editor.document.uri)
            }
        }),
    )
}
