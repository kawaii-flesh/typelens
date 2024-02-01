import * as vscode from 'vscode'
import {
    SymbolInformation,
    SymbolKind,
    DocumentSymbol,
    TextDocument,
    CodeLens,
    Range,
    Location,
    commands,
    Command,
} from 'vscode'
import { AppConfiguration } from './appConfiguration'
import { Minimatch } from 'minimatch'
import { SymbolKindInterst, standardSymbolKindSet } from './symbolKindSet'
import { TypeLensConfiguration } from './typeLensConfiguration'

export type FlattenedSymbols = {
    kind: SymbolKind
    name: string
    range: Range
}

export class MethodReferenceLens extends CodeLens {
    constructor(
        range: Range,
        public uri: vscode.Uri,
        public name: string,
        public kind: SymbolKind,
        command?: Command,
    ) {
        super(range, command)
    }
}
class UnusedDecoration {
    ranges: vscode.Range[] = []
    decoration: vscode.TextEditorDecorationType
}
export class TSCodeLensProvider implements vscode.CodeLensProvider {
    config: AppConfiguration

    private unusedDecorations: Map<string, UnusedDecoration> = new Map<string, UnusedDecoration>()

    constructor() {
        this.config = new AppConfiguration()
    }

    reinitDecorations() {
        const settings = this.config.settings
        const editor = vscode.window.activeTextEditor
        if (editor != null) {
            if (this.unusedDecorations.has(editor.document.uri.fsPath)) {
                const unusedDecoration: UnusedDecoration = this.unusedDecorations.get(editor.document.uri.fsPath)
                let decoration = unusedDecoration.decoration
                if (unusedDecoration.ranges.length > 0 && decoration) {
                    editor.setDecorations(decoration, unusedDecoration.ranges)
                }
                decoration.dispose()
                decoration = null
            }

            if (settings.decorateunused) {
                const unusedDecoration = new UnusedDecoration()
                this.unusedDecorations.set(editor.document.uri.fsPath, unusedDecoration)
                unusedDecoration.decoration = vscode.window.createTextEditorDecorationType({
                    color: settings.unusedcolor,
                })
            }
        }
    }
    private isDocumentSymbol(symbol: vscode.SymbolInformation | DocumentSymbol): symbol is DocumentSymbol {
        return (symbol as DocumentSymbol).children != null
    }

    private isExcluded(fileName: string) {
        const exclusionList = this.config.settings.exclude || []
        return exclusionList.some(pattern => {
            return new Minimatch(pattern).match(fileName)
        })
    }

    private isUnsupportedSymbol(symbolInformation: { name: string }) {
        return (
            symbolInformation.name.indexOf('.') > -1 ||
            symbolInformation.name == '<unknown>' ||
            symbolInformation.name == '<function>' ||
            symbolInformation.name == '<class>' ||
            symbolInformation.name.endsWith(' callback') ||
            this.config.settings.ignorelist.indexOf(symbolInformation.name) > -1
        )
    }

    private symbolKindFilter(symbols: FlattenedSymbols[], languageId: string) {
        return symbols.filter(symbolInformation => {
            let knownInterest: SymbolKind[] = <SymbolKind[]>SymbolKindInterst[languageId]
            if (!knownInterest) {
                knownInterest = standardSymbolKindSet
            }

            const isKnownInterest = knownInterest.indexOf(symbolInformation.kind) > -1
            if (!isKnownInterest) return

            const isSymbolKindAllowed =
                (symbolInformation.kind === SymbolKind.Method && this.config.settings.showReferencesForMethods) ||
                (symbolInformation.kind === SymbolKind.Function && this.config.settings.showReferencesForFunctions) ||
                (symbolInformation.kind === SymbolKind.Property && this.config.settings.showReferencesForProperties) ||
                (symbolInformation.kind === SymbolKind.Class && this.config.settings.showReferencesForClasses) ||
                (symbolInformation.kind === SymbolKind.Interface && this.config.settings.showReferencesForInterfaces) ||
                (symbolInformation.kind === SymbolKind.Enum && this.config.settings.showReferencesForEnums) ||
                (symbolInformation.kind === SymbolKind.Constant && this.config.settings.showReferencesForConstants) ||
                (symbolInformation.kind === SymbolKind.Variable && this.config.settings.showReferencesForVariables)

            return isSymbolKindAllowed
        })
    }

    getNonBlackBoxedLocations(filteredLocations: Location[]) {
        const blackboxList = this.config.settings.blackbox || []
        const nonBlackBoxedLocations = filteredLocations.filter(location => {
            const fileName = location.uri.path
            return !blackboxList.some(pattern => {
                return new Minimatch(pattern).match(fileName)
            })
        })
        return nonBlackBoxedLocations
    }
    private createCodeLens(
        codeLens: MethodReferenceLens,
        filteredLocations: Location[],
        settings: TypeLensConfiguration,
    ) {
        const isSameDocument = codeLens.uri == vscode.window.activeTextEditor.document.uri
        const nonBlackBoxedLocations = this.getNonBlackBoxedLocations(filteredLocations)
        const amount = nonBlackBoxedLocations.length

        if (amount == 0 && filteredLocations.length == 0 && isSameDocument && settings.decorateunused) {
            if (this.unusedDecorations.has(codeLens.uri.fsPath)) {
                const decorationsForFile = this.unusedDecorations.get(codeLens.uri.fsPath)
                decorationsForFile.ranges.push(codeLens.range)
                this.updateDecorations(codeLens.uri)
            }
        }
        const message = this.formatMessage(amount, settings, codeLens)
        if (amount == 0 && filteredLocations.length != 0) {
            return new CodeLens(
                new vscode.Range(
                    codeLens.range.start.line,
                    codeLens.range.start.character,
                    codeLens.range.start.line,
                    90000,
                ),
                {
                    command: '',
                    title: settings.blackboxTitle,
                },
            )
        } else if (amount > 0) {
            return new CodeLens(
                new vscode.Range(
                    codeLens.range.start.line,
                    codeLens.range.start.character,
                    codeLens.range.start.line,
                    90000,
                ),
                {
                    command: 'editor.action.showReferences',
                    title: message,
                    arguments: [codeLens.uri, codeLens.range.start, nonBlackBoxedLocations],
                },
            )
        } else {
            return new CodeLens(
                new vscode.Range(
                    codeLens.range.start.line,
                    codeLens.range.start.character,
                    codeLens.range.start.line,
                    90000,
                ),
                {
                    command: 'editor.action.findReferences',
                    title: message,
                    arguments: [codeLens.uri, codeLens.range.start],
                },
            )
        }
    }

    private getResultRange(
        range: Range,
        leftMatch: Range,
        rightMatch: Range,
        document: TextDocument,
        documentOffset: number,
    ) {
        if (leftMatch == null && rightMatch == null) {
            return range
        } else if (leftMatch != null && rightMatch == null) {
            return leftMatch
        } else if (leftMatch == null && rightMatch != null) {
            return rightMatch
        } else {
            return documentOffset - document.offsetAt(leftMatch.start) <
                document.offsetAt(rightMatch.start) - documentOffset
                ? leftMatch
                : rightMatch
        }
    }

    getMethodReferenceLens(symbols: FlattenedSymbols[], document: TextDocument) {
        const usedPositions = []
        return symbols
            .map(symbolInformation => {
                if (symbolInformation.name == undefined) return
                const range = symbolInformation.range

                if (!this.isUnsupportedSymbol(symbolInformation) && range) {
                    const symbolText = document.getText(range)
                    const documentOffset = document.offsetAt(range.start)

                    let leftMatch: Range
                    let rightMatch: Range

                    if (symbolText.indexOf(symbolInformation.name) > -1) {
                        const maxOffset = documentOffset + symbolText.length
                        let lookupOffset = documentOffset
                        while (lookupOffset < maxOffset) {
                            const start = document.positionAt(lookupOffset)
                            const wordRange = document.getWordRangeAtPosition(start)
                            if (wordRange && document.getText(wordRange) == symbolInformation.name) {
                                rightMatch = wordRange
                                break
                            } else {
                                lookupOffset += symbolInformation.name.length
                            }
                        }
                    } else {
                        const minOffset = Math.max(documentOffset - symbolText.length, 0)
                        let lookupOffset = documentOffset
                        while (lookupOffset > minOffset) {
                            const start = document.positionAt(lookupOffset)
                            const wordRange = document.getWordRangeAtPosition(start)
                            if (wordRange && document.getText(wordRange) == symbolInformation.name) {
                                leftMatch = wordRange
                                break
                            } else {
                                lookupOffset -= symbolInformation.name.length
                            }
                        }
                    }
                    const resultingRange = this.getResultRange(range, leftMatch, rightMatch, document, documentOffset)

                    const position = document.offsetAt(resultingRange.start)
                    if (!usedPositions[position]) {
                        usedPositions[position] = 1
                        return new MethodReferenceLens(
                            resultingRange,
                            document.uri,
                            symbolInformation.name,
                            symbolInformation.kind,
                        )
                    }
                }
            })
            .filter(item => item != null)
    }

    private getFlattenedSymbols(symbols: vscode.SymbolInformation[] | vscode.DocumentSymbol[]) {
        const flattenedSymbols: FlattenedSymbols[] = []
        const walk = (p: DocumentSymbol) => {
            p.children.forEach(p => walk(p))
            flattenedSymbols.push(p)
        }

        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i]
            if (this.isDocumentSymbol(symbol)) {
                walk(symbol)
            } else {
                if (symbol.location) {
                    flattenedSymbols.push({
                        kind: symbol.kind,
                        name: symbol.name,
                        range: symbol.location.range,
                    })
                }
            }
        }
        return flattenedSymbols
    }

    private formatMessage(amount: number, settings: TypeLensConfiguration, codeLens: MethodReferenceLens) {
        let message
        if (amount == 0) {
            message = settings.noreferences
            message = message.replace('{0}', codeLens.name + '')
        } else if (amount == 1) {
            message = settings.singular
            message = message.replace('{0}', amount + '')
        } else {
            message = settings.plural
            message = message.replace('{0}', amount + '')
        }
        return message
    }

    formatMessageForOutput(document: TextDocument, symbol: MethodReferenceLens) {
        const positionStart = symbol.range.start
        return `${vscode.SymbolKind[symbol.kind]}: "${symbol.name}" ${document.fileName}:${positionStart.line + 1}:${positionStart.character + 1}`
    }
    private async getSymbolsReferences(document: TextDocument) {
        const settings = this.config.settings
        this.reinitDecorations()
        if (this.isExcluded(document.uri.fsPath)) {
            return []
        }
        if (!this.config.typeLensEnabled || settings.skiplanguages.indexOf(document.languageId) > -1) {
            return
        }

        const symbols = await commands.executeCommand<SymbolInformation[] | DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            document.uri,
        )
        const flattenedSymbols = this.getFlattenedSymbols(symbols)
        return this.symbolKindFilter(flattenedSymbols, document.languageId)
    }

    async provideCodeLenses(document: TextDocument): Promise<MethodReferenceLens[]> {
        const filteredSymbols = await this.getSymbolsReferences(document)
        return this.getMethodReferenceLens(filteredSymbols, document)
    }
    async getFilteredLocations(codeLens: MethodReferenceLens) {
        const locations = await commands.executeCommand<Location[]>(
            'vscode.executeReferenceProvider',
            codeLens.uri,
            codeLens.range.start,
        )
        const settings = this.config.settings
        let filteredLocations = locations
        if (settings.excludeself) {
            filteredLocations = locations.filter(location => {
                const isSameDocument = codeLens.uri.toString() == location.uri.toString()
                const isLocationOverlaps = codeLens.range.contains(location.range)
                const overlapsWithOriginalSymbol = isSameDocument && isLocationOverlaps
                return !overlapsWithOriginalSymbol
            })
            return filteredLocations
        }
    }
    async resolveCodeLens(codeLens: CodeLens): Promise<CodeLens> {
        if (codeLens instanceof MethodReferenceLens) {
            const filteredLocations = await this.getFilteredLocations(codeLens)
            return this.createCodeLens(codeLens, filteredLocations, this.config.settings)
        }
    }
    updateDecorations(uri: vscode.Uri) {
        const isSameDocument = uri == vscode.window.activeTextEditor.document.uri
        if (isSameDocument) {
            if (this.unusedDecorations.has(uri.fsPath)) {
                const unusedDecoration = this.unusedDecorations.get(uri.fsPath)
                const decoration = unusedDecoration.decoration
                const unusedDecorations = unusedDecoration.ranges
                vscode.window.activeTextEditor.setDecorations(decoration, unusedDecorations)
            }
        }
    }
}
