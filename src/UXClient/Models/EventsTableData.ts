import {Utils} from "./../Utils";
import {ChartComponentData} from "./ChartComponentData";
import {TimeSeriesEvent} from "./TimeSeriesEvent";
import * as d3 from 'd3';
import { TimeSeriesEventCell } from "./TimeSeriesEventCell";

class EventsTableData {
    public columns = {};
    public rows = [];
    public events: Array<TimeSeriesEvent> = [];

	constructor(){
        
    }

    public setEvents (rawEvents, fromTsx) {
        this.events = [];
        rawEvents.forEach((rawEvent) => {
            if (!fromTsx) {
                rawEvent = Object.keys(rawEvent).reduce((newEventMap, currColName) => {
                    newEventMap[currColName] = {
                        name: currColName, 
                        value: rawEvent[currColName]
                    };
                    return newEventMap;
                }, {});
            }
            var event = new TimeSeriesEvent(rawEvent);
            this.events.push(event);
        });
        this.constructColumns();
    }

    public sortEvents (columnKey, isAscending) {
        var sortType = this.columns[columnKey].type;
        var aTop = 1;
        var bTop = -1;
        if (!isAscending) {
            aTop = -1;
            bTop = 1;
        }
        this.events.sort((a: TimeSeriesEvent, b: TimeSeriesEvent) => {
            if ((a.cells && a.cells[columnKey]) || (b.cells && b.cells[columnKey])) {
                var aConverted = (a.cells && a.cells[columnKey]) ? a.cells[columnKey].value : null;
                var bConverted = (b.cells && b.cells[columnKey]) ? b.cells[columnKey].value : null;
                
                //one value is null
                if (aConverted == null)
                    return bTop;
                if (bConverted == null)
                    return aTop;

                //convert to appropriate type
                if (sortType == "Double"){
                    aConverted = Number(aConverted);
                    bConverted = Number(bConverted);
                }
                else if (sortType == "DateTime") {
                    aConverted = (new Date(aConverted)).valueOf();
                    bConverted = (new Date(bConverted)).valueOf();
                }

                //compare
                if (aConverted > bConverted)
                    return aTop;
                if (aConverted < bConverted)
                    return bTop;
                return 0;
            }
            return 0;
        });
    }

    public constructColumns () {
        var newColumns = {};
        this.events.forEach((event: TimeSeriesEvent) => {
            Object.keys(event.cells).forEach((cellKey: string) => {
                var cell = event.cells[cellKey];
                if (this.columns[cell.key] == null) {
                    newColumns[cell.key] = { 
                        key:  cell.key,
                        name: cell.name,
                        visible: true,
                        type: cell.type
                    }
                } else {
                    newColumns[cell.key] = this.columns[cell.key];
                }
            })
        });
        this.columns = newColumns;
    }

    public generateCSVString (includeAllColumns: boolean = true, offset: number = 0): string {
        //replace comma at end of line with end line character
        var endLine = (s: string): string => {
            return s.slice(0, s.length - 1) + "\n";
        }

        var columnKeys = ["timestamp_DateTime"].concat(Object.keys(this.columns).filter((a) => {
            return a != "timestamp_DateTime";
        }));

        var csvString = endLine(columnKeys.reduce((headerString, columnKey) => {
            return headerString + this.columns[columnKey].name + ",";
        }, ""));

        this.events.forEach((event: TimeSeriesEvent) => {
            csvString += endLine(columnKeys.reduce((lineString, columnKey) => {
                return lineString + ((event.cells[columnKey] != null && event.cells[columnKey].value != null) ? 
                                        event.cells[columnKey].value : "") + ","
            }, ""));
        });
        return csvString;
    }

}
export {EventsTableData}
