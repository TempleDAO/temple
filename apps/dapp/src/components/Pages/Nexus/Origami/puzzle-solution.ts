import { Line2, isLine2 } from './origami-types';
import { vec2 } from './vec2';

type LineEntry = Line2 | [Line2, LineEntry[]]
type PuzzleStage = LineEntry[]
export interface PuzzleSpec {
  imgUrl: string
  solution: PuzzleStage[]
}

// traverse the solution tree and check if the lines match
export function checkPuzzleSolution(
  lines: Readonly<Line2[]>,
  entriesList: Readonly<PuzzleSpec['solution']>,
  lineLookup: Record<string, LineEntry[] | undefined> = {}
): boolean {
  const entries = entriesList[0];
  if (entries && entries.length > 0) {
    entries.forEach(entry => {
      if (isLine2(entry)) {
        lineLookup[vec2.formatList(entry)] = [];
      } else {
        const [line, children] = entry;
        lineLookup[vec2.formatList(line)] = children
      }
    });
  } else if (entriesList.length > 0 && Object.keys(lineLookup).length == 0) {
    return checkPuzzleSolution(lines, entriesList.slice(1), lineLookup);
  }

  // console.log("lines:", lines);
  // console.log("lineLookup:", lineLookup);
  // console.log("entriesList:", entriesList);

  const line = lines[0];
  const lineStr = line && vec2.formatList(line);
  if (lineStr) {
    const subEntries = lineLookup[lineStr];
    delete lineLookup[lineStr];
    if (subEntries) { // line matched
      return checkPuzzleSolution(lines.slice(1), [subEntries, ...entriesList.slice(1)], lineLookup);
    }
  }
  // solved when all lines are matched and all entries are used
  return lines.length == 0 && Object.keys(lineLookup).length == 0;
}
