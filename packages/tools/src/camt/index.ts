import { type X2jOptions, XMLParser } from 'fast-xml-parser'

export const parseCamt053 = ({
  xml,
  options
}: {
  xml: string
  options: X2jOptions
}) => {
  const parser = new XMLParser(options)
  const json = parser.parse(xml)

  return json.Document
}
