import _ from 'lodash';
import tpl from './index.html';
import { Set, Map } from 'immutable';

class ProjectLayersPageController {
    constructor(
        $rootScope,
        $state,
        $q,
        $log,
        projectService,
        paginationService,
        modalService,
        authService,
        mapService,
        projectEditService,
        uploadService
    ) {
        'ngInject';
        $rootScope.autoInject(this, arguments);
    }

    $onInit() {
        this.selected = new Map();
        const visibleLayers = this.projectEditService.getVisibleProjectLayers();
        this.visible = visibleLayers.size ? visibleLayers : Set([this.project.defaultLayerId]);
        this.uploadStatusByLayer = {};
        this.syncMapLayersToVisible();
        this.projectService.getProjectPermissions(this.project, this.user).then(permissions => {
            this.permissions = permissions.map(p => p.actionType);
        });
        this.projectService.getProjectLayerStats(this.project.id).then(layerSceneCounts => {
            this.layerStats = layerSceneCounts;
        });
        this.fetchPage();
        this.uploadStatusMap = this.uploadService.uploadStatusMap;
    }

    $onDestroy() {
        // remove layers from map
        this.getMap().then(map => {
            map.deleteLayers('Project Layers');
        });
    }

    getMap() {
        return this.mapService.getMap('project');
    }

    getSceneCount(layerId) {
        return this.layerStats ? this.layerStats[layerId] : null;
    }

    fetchPage(page = this.$state.params.page || 1) {
        this.layerList = [];
        this.layerActions = {};
        const currentQuery = this.projectService
            .getProjectLayers(this.project.id, {
                pageSize: 30,
                page: page - 1
            })
            .then(
                paginatedResponse => {
                    this.layerList = paginatedResponse.results;
                    this.layerList.forEach(layer => {
                        layer.subtext = '';
                        if (layer.id === this.project.defaultLayerId) {
                            layer.subtext += 'Default layer';
                        }
                        if (layer.smartLayerId) {
                            layer.subtext += layer.subtext.length ? ', Smart layer' : 'Smart Layer';
                        }
                        this.getLayerUploads(layer.id);
                    });
                    const defaultLayer = this.layerList.find(
                        l => l.id === this.project.defaultLayerId
                    );
                    this.layerActions = this.layerList.map(l =>
                        this.addLayerActions(l, defaultLayer === l)
                    );
                    this.pagination = this.paginationService.buildPagination(paginatedResponse);
                    this.paginationService.updatePageParam(page);
                    if (this.currentQuery === currentQuery) {
                        delete this.fetchError;
                    }
                },
                e => {
                    if (this.currentQuery === currentQuery) {
                        this.fetchError = e;
                    }
                }
            )
            .finally(() => {
                if (this.currentQuery === currentQuery) {
                    delete this.currentQuery;
                }
            });
        this.currentQuery = currentQuery;
        return currentQuery;
    }

    addLayerActions(layer, isDefaultLayer) {
        if (!this.permissions.includes('Edit')) {
            return [];
        }
        const alertAoiAction = {
            icon: 'icon-warning color-danger',
            name: 'Edit AOI',
            tooltip: 'No AOI defined for this layer',
            callback: () => this.goToAoiDef(layer.id),
            menu: false
        };
        const editAoiAction = {
            name: 'Edit AOI',
            callback: () => this.goToAoiDef(layer.id),
            menu: true
        };
        const previewAction = {
            icons: [
                {
                    icon: 'icon-eye',
                    isActive: () => this.visible.has(layer.id)
                },
                {
                    icon: 'icon-eye-off',
                    isActive: () => !this.visible.has(layer.id)
                }
            ],
            name: 'Preview',
            tooltip: 'Show/hide on map',
            callback: () => this.onHide(layer.id),
            menu: false
        };
        const goToLayerAction = {
            icon: 'icon-map',
            name: 'View on map',
            tooltip: 'View layer on map',
            callback: () => this.viewLayerOnMap(layer),
            menu: false
        };
        const editAction = {
            name: 'Edit',
            callback: () =>
                this.$state.go('project.layer', { projectId: this.project.id, layerId: layer.id }),
            menu: true
        };
        const setDefaultAction = {
            name: 'Set as default layer',
            callback: () => this.setProjectDefaultLayer(layer),
            menu: true
        };
        const createAnalysisAction = {
            name: 'Create analysis',
            callback: () => this.createAnalysis(layer),
            menu: true
        };
        const publishAction = {
            name: 'Publishing',
            callback: () =>
                this.$state.go('project.layer.settings.publishing', {
                    projectId: this.project.id,
                    layerId: layer.id
                }),
            menu: true
        };
        const exportAction = {
            name: 'Export',
            callback: () =>
                this.$state.go('project.layer.settings.publishing', {
                    projectId: this.project.id,
                    layerId: layer.id
                }),
            menu: true
        };
        const importAction = {
            name: 'Import imagery',
            callback: () =>
                this.modalService.open({
                    component: 'rfSceneImportModal',
                    resolve: {
                        project: () => this.project,
                        layer: () => layer,
                        origin: () => 'project'
                    }
                })
        };
        const browseAction = {
            name: 'Browse for imagery',
            callback: () =>
                this.$state.go('project.layer.browse', {
                    projectId: this.project.id,
                    layerId: layer.id
                })
        };
        const settingsAction = {
            name: 'Settings',
            callback: () =>
                this.$state.go('project.layer.settings', {
                    projectId: this.project.id,
                    layerId: layer.id
                }),
            menu: true
        };
        const deleteAction = {
            name: 'Delete',
            callback: () => this.deleteProjectLayers(layer),
            menu: true
        };
        const section = {
            section: true
        };

        // TODO: add implement these when the views are finished:
        // const unimplementedActions = [publishAction, exportAction, settingsAction];
        const layerActions = [
            previewAction,
            editAction,
            editAoiAction,
            createAnalysisAction,
            importAction,
            browseAction
        ];

        return [
            ...layerActions,
            ...(_.get(layer, 'geometry.type') ? [goToLayerAction] : [alertAoiAction]),
            ...(!isDefaultLayer ? [setDefaultAction, deleteAction] : [])
        ];
    }

    viewLayerOnMap(layer) {
        this.getMap().then(map => {
            let bounds = L.geoJSON(layer.geometry).getBounds();
            map.map.fitBounds(bounds);
            this.visible = new Set([layer.id]);
            this.projectEditService.setVisibleProjectLayers(this.visible);
            this.syncMapLayersToVisible();
        });
    }

    zoomToSelected() {
        // get geometries
        const geoms = this.selected
            .valueSeq()
            .toArray()
            .map(s => s.geometry);
        const bounds = L.geoJSON(geoms).getBounds();

        // go to bounds
        this.getMap().then(map => {
            map.map.fitBounds(bounds);
        });
    }

    showSelected() {
        this.visible = this.visible.union(this.selected.keySeq().toArray());
        this.syncMapLayersToVisible();
    }

    hideSelected() {
        this.visible = this.visible.subtract(this.selected.keySeq().toArray());
        this.syncMapLayersToVisible();
    }

    deleteSelected() {
        this.deleteProjectLayers(this.selected.valueSeq().toArray());
    }

    hideAll() {
        this.visible = new Set();
        this.syncMapLayersToVisible();
    }

    allVisibleSelected() {
        let layerSet = Set(this.layerList.map(l => l.id));
        return layerSet.intersect(this.selected.keySeq()).size === layerSet.size;
    }

    selectAll() {
        if (this.allVisibleSelected()) {
            this.selected = this.selected.clear();
        } else {
            this.selected = this.selected.merge(new Map(this.layerList.map(i => [i.id, i])));
        }
        this.updateSelectText();
    }

    updateSelectText() {
        if (this.allVisibleSelected()) {
            this.selectText = `Clear selected (${this.selected.size})`;
        } else {
            this.selectText = `Select visible (${this.selected.size})`;
        }
    }

    onSelect(id) {
        if (this.selected.has(id)) {
            this.selected = this.selected.delete(id);
        } else {
            const layer = this.layerList.find(l => l.id === id);
            this.selected = this.selected.set(id, layer);
        }
        this.updateSelectText();
    }

    isSelected(layerId) {
        return this.selected.has(layerId);
    }

    onHide(id) {
        if (this.visible.has(id)) {
            this.visible = this.visible.delete(id);
        } else {
            this.visible = this.visible.add(id);
        }
        this.projectEditService.setVisibleProjectLayers(this.visible);
        this.syncMapLayersToVisible();
    }

    setProjectDefaultLayer(layer) {
        this.projectService
            .updateProject(
                Object.assign({}, this.project, {
                    defaultLayerId: layer.id
                })
            )
            .then(() => {
                this.$state.go('.', {}, { inherit: true, reload: true });
            });
    }

    createAnalysis(layer) {
        let layers = this.selected.valueSeq().toArray();
        if (layer) {
            layers = [layer];
        }
        let layersWithoutAOI = layers.filter(l => !_.get(l, 'geometry.type'));
        if (layersWithoutAOI.length) {
            this.aoiRequiredModal(layersWithoutAOI[0]);
        } else {
            this.$state.go('project.create-analysis', { layers });
        }
    }

    deleteProjectLayers(layers) {
        let modal;
        let ids = layers.length ? layers.map(l => l.id) : [layers.id];
        if (ids.length > 1) {
            modal = this.modalService.open({
                component: 'rfFeedbackModal',
                resolve: {
                    title: () => `Really delete ${ids.length} layers?`,
                    subtitle: () => 'Deleting layers cannot be undone',
                    content: () =>
                        '<h2>Do you wish to continue?</h2>' +
                        '<p>Future attempts to access these ' +
                        'layers or associated annotations, tiles, and scenes will fail.',
                    feedbackIconType: () => 'danger',
                    feedbackIcon: () => 'icon-warning',
                    feedbackBtnType: () => 'btn-danger',
                    feedbackBtnText: () => 'Delete layers',
                    cancelText: () => 'Cancel'
                }
            }).result;
        } else {
            modal = this.modalService.open({
                component: 'rfFeedbackModal',
                resolve: {
                    title: () => 'Really delete layer?',
                    subtitle: () => 'Deleting layers cannot be undone',
                    content: () =>
                        '<h2>Do you wish to continue?</h2>' +
                        '<p>Future attempts to access this ' +
                        'layer or associated annotations, tiles, and scenes will fail.',
                    feedbackIconType: () => 'danger',
                    feedbackIcon: () => 'icon-warning',
                    feedbackBtnType: () => 'btn-danger',
                    feedbackBtnText: () => 'Delete layer',
                    cancelText: () => 'Cancel'
                }
            }).result;
        }
        modal
            .then(() => {
                const promises = ids.map(id =>
                    this.projectService.deleteProjectLayer(this.project.id, id)
                );
                this.$q
                    .all(promises)
                    .then(() => {
                        this.visible = this.visible.subtract(this.selected.keySeq().toArray());
                        this.projectEditService.setVisibleProjectLayers(this.visible);
                        this.selected = new Map();
                        this.syncMapLayersToVisible();
                    })
                    .catch(e => {
                        this.$log.error(e);
                    })
                    .finally(() => {
                        this.fetchPage();
                    });
            })
            .catch(() => {
                // modal closed
            });
    }

    showDefaultLayer() {
        this.visible = Set([this.project.defaultLayerId]);
        this.projectEditService.setVisibleProjectLayers(this.visible);
        this.syncMapLayersToVisible();
    }

    showPageLayers() {
        this.visible = this.visible.union(this.layerList.map(l => l.id));
        this.projectEditService.setVisibleProjectLayers(this.visible);
        this.syncMapLayersToVisible();
    }

    onLayerFocus(layer) {
        if (layer) {
            this.focusedLayer = layer;
        } else {
            delete this.focusedLayer;
        }
    }

    syncMapLayersToVisible() {
        // TODO do this more efficiently (don't re-add existing layers)
        let mapLayers = this.visible
            .toArray()
            .map(layer => this.projectService.mapLayerFromLayer(this.project, layer));
        this.getMap().then(map => {
            map.setLayer('Project Layers', mapLayers, true);
        });
    }

    showNewLayerModal() {
        const modal = this.modalService.open({
            component: 'rfProjectLayerCreateModal',
            resolve: {
                projectId: () => this.project.id
            }
        });

        modal.result.then(() => this.fetchPage()).catch(() => {});
    }

    createItemInfo(layer) {
        return {
            id: layer.id,
            name: layer.name,
            subtext: layer.subtext,
            date: layer.createdAt,
            colorGroupHex: layer.colorGroupHex,
            geometry: layer.geometry
        };
    }

    aoiRequiredModal(layer) {
        this.modalService
            .open({
                component: 'rfFeedbackModal',
                resolve: {
                    title: () => 'No AOI defined',
                    content: () => `
                        <h2>
                            Creating an analyses requires an AOI
                        </h2>
                        <p>
                            At least one selected layer does not have an AOI defined.
                            Click on the missing AOI warning icon
                            (<i class="icon-warning color-danger"></i>) to define an AOI.
                        </p>
                    `,
                    feedbackIconType: () => 'warning',
                    feedbackIcon: () => 'icon-warning',
                    confirmText: () => 'OK'
                }
            })
            .catch(() => {});
    }

    goToAoiDef(id) {
        this.$state.go('project.layer.aoi', { layerId: id, projectId: this.project.id });
    }

    getLayerUploads(layerId) {
        this.$q
            .all({
                pendingUploads: this.uploadService.query({
                    uploadStatus: 'UPLOADED',
                    projectId: this.projectId,
                    layerId,
                    pageSize: 0
                }),
                failedUploads: this.uploadService.query({
                    uploadStatus: 'FAILED',
                    projectId: this.projectId,
                    layerId,
                    pageSize: 0
                })
            })
            .then(({ pendingUploads, failedUploads }) => {
                this.uploadStatusByLayer[layerId] = [
                    { status: 'UPLOADED', count: pendingUploads.count },
                    { status: 'FAILED', count: failedUploads.count }
                ];
            })
            .catch(err => {
                this.$log.error(err);
                this.uploadStatusByLayer[layerId] = [];
            });
    }
}

const component = {
    bindings: {
        user: '<',
        userRoles: '<',
        project: '<'
    },
    templateUrl: tpl,
    controller: ProjectLayersPageController.name
};

export default angular
    .module('components.pages.projects.layers', [])
    .controller(ProjectLayersPageController.name, ProjectLayersPageController)
    .component('rfProjectLayersPage', component).name;
