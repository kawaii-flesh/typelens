import { CodeLens, TextEditorDecorationType, Range, Uri, SymbolKind, Command } from 'vscode'

export type FlattenedSymbols = {
    kind: SymbolKind
    name: string
    range: Range
}

export class MethodReferenceLens extends CodeLens {
    constructor(
        range: Range,
        public uri: Uri,
        public name: string,
        public kind: SymbolKind,
        command?: Command,
    ) {
        super(range, command)
    }
}
export class UnusedDecoration {
    ranges: Range[] = []
    decoration: TextEditorDecorationType
}
