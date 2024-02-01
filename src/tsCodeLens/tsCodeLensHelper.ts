import { Minimatch } from 'minimatch'
import { AppConfiguration } from '../application/appConfiguration'
import { MethodReferenceLens } from './types'
import { Range } from 'vscode'

export class Helper {
    constructor(private config: AppConfiguration) {}
    isExcluded(fileName: string) {
        const exclusionList = this.config.settings.exclude || []
        return exclusionList.some(pattern => {
            return new Minimatch(pattern).match(fileName)
        })
    }

    isUnsupportedSymbol(symbolInformation: { name: string }) {
        return (
            symbolInformation.name.indexOf('.') > -1 ||
            symbolInformation.name == '<unknown>' ||
            symbolInformation.name == '<function>' ||
            symbolInformation.name == '<class>' ||
            symbolInformation.name.endsWith(' callback') ||
            this.config.settings.ignorelist.indexOf(symbolInformation.name) > -1
        )
    }

    formatMessage(amount: number, codeLens: MethodReferenceLens) {
        let message
        if (amount == 0) {
            message = this.config.settings.noreferences
            message = message.replace('{0}', codeLens.name + '')
        } else if (amount == 1) {
            message = this.config.settings.singular
            message = message.replace('{0}', amount + '')
        } else {
            message = this.config.settings.plural
            message = message.replace('{0}', amount + '')
        }
        return message
    }

    getRangeForCodeLens(codeLens: MethodReferenceLens) {
        return new Range(codeLens.range.start.line, codeLens.range.start.character, codeLens.range.start.line, 90000)
    }
}
