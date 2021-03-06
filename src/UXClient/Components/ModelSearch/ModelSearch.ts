import * as d3 from 'd3';
import './ModelSearch.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import {ServerClient} from '../../../ServerClient/ServerClient';
import 'awesomplete';
import { Hierarchy } from '../Hierarchy/Hierarchy';
import { ChartOptions } from '../../Models/ChartOptions';
import { ModelAutocomplete } from '../ModelAutocomplete/ModelAutocomplete';

class ModelSearch extends Component{
    private server: ServerClient; 
    private hierarchies;
    private clickedInstance;
    private wrapper;
    private types;
    public chartOptions: ChartOptions = new ChartOptions();
    private instanceResults;
    private usedContinuationTokens = {};
    private contextMenu; 
    private currentResultIndex= -1;

	constructor(renderTarget: Element){ 
        super(renderTarget); 
        this.server = new ServerClient();
        d3.select("html").on("click." + Utils.guid(), () => {
            if (this.clickedInstance && d3.event.target != this.clickedInstance && this.contextMenu) {
                this.closeContextMenu();
                this.clickedInstance = null;
            }
        })
	}

	ModelSearch(){
	}
	
	public render(environmentFqdn: string, getToken: any, hierarchyData: any, chartOptions: any){
        this.chartOptions.setOptions(chartOptions);
        let self = this;
        let continuationToken, searchText;
        let targetElement = d3.select(this.renderTarget);	
        targetElement.html('');	
        this.wrapper = targetElement.append('div').attr('class', 'tsi-modelSearchWrapper');
        super.themify(this.wrapper, this.chartOptions.theme);
        let inputWrapper = this.wrapper.append("div")
            .attr("class", "tsi-modelSearchInputWrapper");

        let autocompleteOnInput = (st) => {
            self.usedContinuationTokens = {};

            // blow results away if no text
            if(st.length === 0){
                self.instanceResults.html('');
                self.currentResultIndex= -1;
                (hierarchyElement.node() as any).style.display = 'block';
                (showMore.node() as any).style.display = 'none';
                return;
            }
            (hierarchyElement.node() as any).style.display = 'none';
            self.instanceResults.html('');
            self.currentResultIndex = -1;
            noResults.style('display', 'none');
            searchInstances(st);
            searchText = st;
        }

        let modelAutocomplete = new ModelAutocomplete(inputWrapper.node());
        modelAutocomplete.render(environmentFqdn, getToken, {onInput: autocompleteOnInput, onKeydown: (event, ap) => {this.handleKeydown(event, ap)}, ...chartOptions});
        var ap = modelAutocomplete.ap;

        let results = this.wrapper.append('div')
            .attr("class", "tsi-modelSearchResults").on('scroll', function(){
                self.closeContextMenu();
                let that = this as any;
                if(that.scrollTop + that.clientHeight + 150 > (self.instanceResults.node() as any).clientHeight){
                    searchInstances(searchText, continuationToken);
                }
            })
        let noResults = results.append('div').html('No results').classed('tsi-noResults', true).style('display', 'none');
        let instanceResultsWrapper = results.append('div').attr('class', 'tsi-modelSearchInstancesWrapper')
        this.instanceResults = instanceResultsWrapper.append('div').attr('class', 'tsi-modelSearchInstances');
        let showMore = instanceResultsWrapper.append('div').attr('class', 'tsi-showMore').html('Show more...').on('click', () => searchInstances(searchText, continuationToken)).style('display', 'none');

        let hierarchyElement = this.wrapper.append('div')
            .attr("class", "tsi-hierarchyWrapper");
        let hierarchy = new Hierarchy(hierarchyElement.node() as any);
        hierarchy.render(hierarchyData, {...this.chartOptions, withContextMenu: true});

        let searchInstances = (searchText, ct = null) => {
            var self = this;
            if(ct === 'END')
                return;
            if(ct === null || !self.usedContinuationTokens[ct]){
                self.usedContinuationTokens[ct] = true;
                getToken().then(token => {
                    self.server.getTimeseriesInstancesSearch(token, environmentFqdn, searchText, ct).then(r => {
                        continuationToken = r.instancesContinuationToken;
                        if(!continuationToken)
                            continuationToken = 'END';
                        (showMore.node() as any).style.display = continuationToken !== 'END' ? 'block' : 'none';
                        if(r.instances.length == 0){
                            noResults.style('display', 'block');
                        }
                        r.instances.forEach(i => {
                            let handleClick = (elt, wrapperMousePos, eltMousePos, fromKeyboard = false) => {
                                self.closeContextMenu();
                                if(self.clickedInstance != elt){
                                    self.clickedInstance = elt;
                                    i.type = self.types.filter(t => t.name === i.highlights.type.split('<hit>').join('').split('</hit>').join(''))[0];
                                    let contextMenuActions = self.chartOptions.onInstanceClick(i);
                                    self.contextMenu = self.wrapper.append('div');
                                    Object.keys(contextMenuActions).forEach((k, cmaIdx) => {
                                        self.contextMenu.append('div').html(k).on('click', contextMenuActions[k]).on('keydown', function(){
                                            let evt = d3.event;
                                            if(evt.keyCode === 13){
                                                this.click();
                                            }
                                            if(evt.keyCode === 13 || evt.keyCode === 37){
                                                self.closeContextMenu();
                                                let results = self.instanceResults.selectAll('.tsi-modelResultWrapper')
                                                results.nodes()[self.currentResultIndex].focus();
                                            }
                                            if(evt.keyCode === 40 && cmaIdx < self.contextMenu.node().children.length){ // down
                                                self.contextMenu.node().children[cmaIdx + 1].focus();
                                            }
                                            if(evt.keyCode === 38 && cmaIdx > 0){ // up
                                                self.contextMenu.node().children[cmaIdx - 1].focus();
                                            }
                                        }).attr('tabindex', '0');
                                    });
                                    self.contextMenu.attr('style', () => `top: ${wrapperMousePos - eltMousePos}px`);
                                    self.contextMenu.classed('tsi-modelSearchContextMenu', true);
                                    d3.select(elt).classed('tsi-resultSelected', true);
                                    if(self.contextMenu.node().children.length > 0 && fromKeyboard){
                                        self.contextMenu.node().children[0].focus();
                                    }
                                }
                                else{
                                    self.clickedInstance = null;
                                }
                            }
                            this.instanceResults.append('div').html(self.getInstanceHtml(i)).on('click', function() {
                                let mouseWrapper = d3.mouse(self.wrapper.node());
                                let mouseElt = d3.mouse(this as any);
                                handleClick(this, mouseWrapper[1], mouseElt[1]);
                            })
                            .on('keydown', () => {
                                let evt = d3.event;
                                if(evt.keyCode === 13){
                                    let resultsNodes = this.instanceResults.selectAll('.tsi-modelResultWrapper').nodes();
                                    let height = 0;
                                    for(var i = 0; i < this.currentResultIndex; i++) {
                                        height += resultsNodes[0].clientHeight;
                                    }
                                    handleClick(this.instanceResults.select('.tsi-modelResultWrapper:focus').node(), height - results.node().scrollTop + 48, 0, true);
                                }
                                self.handleKeydown(evt, ap);
                            }).attr('tabindex', '0').classed('tsi-modelResultWrapper', true);                            
                        })
                    })
                })
            }
        }

        getToken().then(token => {
            this.server.getTimeseriesHierarchies(token, environmentFqdn).then(r => {
                this.hierarchies = r.hierarchies;
            })
        })

        // get types
        getToken().then(token => {
            this.server.getTimeseriesTypes(token, environmentFqdn).then(r => {
                this.types = r.types;
            })
        })
    }

    public handleKeydown(event, ap) {
        if(!ap.isOpened) {
            let results = this.instanceResults.selectAll('.tsi-modelResultWrapper')
            if(results.size()) {
                if(event.keyCode === 40 && this.currentResultIndex < results.nodes().length - 1) {
                    this.currentResultIndex++;
                    results.nodes()[this.currentResultIndex].focus();
                }
                else if(event.keyCode === 38){
                    this.currentResultIndex--;
                    if(this.currentResultIndex <= -1){
                        this.currentResultIndex = -1;
                        ap.input.focus();
                    }
                    else{
                        results.nodes()[this.currentResultIndex].focus();
                    }
                }
            }
        }
    }

    private closeContextMenu() {
        if(this.contextMenu){
            this.contextMenu.remove();
        }
        d3.selectAll('.tsi-resultSelected').classed('tsi-resultSelected', false);
    }

    private getInstanceHtml(i) {
        return `<div class="tsi-modelResult">
                    <div class="tsi-modelPK">
                        ${Utils.strip(i.timeSeriesId.join(' '))}
                    </div>
                    <div class="tsi-modelHighlights">
                        ${Object.keys(i.highlights).map(k => {
                            let highlight = i.highlights[k];
                            if(typeof(highlight) === 'object'){
                                highlight = highlight.join(' ');
                            }
                            let highlighted = highlight.split('<hit>').map(h => h.split('</hit>').map(h2 => Utils.strip(h2)).join('</hit>')).join('<hit>');
                            return Utils.strip(k) + ': ' + highlighted;
                        }).join('<br/>')}
                    </div>
                </div>`
    }
}

export {ModelSearch}
