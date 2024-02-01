'use strict'
import * as vscode from 'vscode'
import { commands } from 'vscode'
import { Application } from './application/application'

const application = new Application()
function setUpCommands(disposables: vscode.Disposable[]) {
    disposables.push(
        commands.registerCommand('typelens.toggle', async () => {
            await application.toggleTypelens()
        }),
    )
    disposables.push(
        commands.registerCommand('typelens.unused', async () => {
            await application.logUnused()
        }),
    )
}

export function activate(context: vscode.ExtensionContext) {
    const disposables: vscode.Disposable[] = context.subscriptions
    setUpCommands(disposables)
    disposables.push(vscode.languages.registerCodeLensProvider(['*'], application.provider))
    disposables.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                application.provider.updateDecorations(editor.document.uri)
            }
        }),
    )
}
