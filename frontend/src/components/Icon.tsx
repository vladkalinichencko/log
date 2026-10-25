import back from "../assets/icons/back.svg";
import forward from "../assets/icons/forward.svg";
import plus from "../assets/icons/plus.svg";
import trash from "../assets/icons/trash.svg";
import pin from "../assets/icons/pin.svg";
import save from "../assets/icons/save.svg";
import expand from "../assets/icons/expand.svg";
import collapse from "../assets/icons/collapse.svg";
import table from "../assets/icons/table.svg";
import chart from "../assets/icons/chart.svg";
import close from "../assets/icons/close.svg";
import play from "../assets/icons/play.svg";
import pause from "../assets/icons/pause.svg";
import fx from "../assets/icons/fx.svg";
import trail from "../assets/icons/trail.svg";
import rename from "../assets/icons/rename.svg";
import gear from "../assets/icons/gear.svg";
import reset from "../assets/icons/reset.svg";
import filter from "../assets/icons/filter.svg";

const ICONS = { back, forward, plus, trash, pin, save, expand, collapse, table, chart, close, play, pause, fx, trail, rename, gear, reset, filter };

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

interface IconProps {
  name: IconName;
}

export function Icon({ name }: IconProps) {
  return <span className="icon" aria-hidden="true" style={{ maskImage: `url("${ICONS[name]}")` }} />;
}
