from .base import BaseModel
from rf.utils.io import get_session


class Upload(BaseModel):
    URL_PATH = "/api/uploads/"

    def __init__(
        self,
        uploadStatus,
        fileType,
        uploadType,
        files,
        datasource,
        metadata,
        visibility,
        id=None,
        createdAt=None,
        createdBy=None,
        modifiedAt=None,
        owner=None,
        projectId=None,
        layerId=None,
        keepInSourceBucket=None,
        annotationProjectId=None,
        generateTasks=False,
        bytesUploaded=0,
    ):
        self.id = id
        self.createdAt = createdAt
        self.createdBy = createdBy
        self.modifiedAt = modifiedAt
        self.owner = owner
        self.uploadStatus = uploadStatus
        self.fileType = fileType
        self.uploadType = uploadType
        self.files = files
        self.datasource = datasource
        self.metadata = metadata
        self.visibility = visibility
        self.projectId = projectId
        self.layerId = layerId
        self.keepInSourceBucket = keepInSourceBucket
        self.annotationProjectId = annotationProjectId
        self.generateTasks = generateTasks
        self.bytesUploaded = bytesUploaded

    def to_dict(self):
        return dict(
            id=self.id,
            createdAt=self.createdAt,
            createdBy=self.createdBy,
            modifiedAt=self.modifiedAt,
            uploadStatus=self.uploadStatus,
            fileType=self.fileType,
            uploadType=self.uploadType,
            files=self.files,
            datasource=self.datasource,
            metadata=self.metadata,
            visibility=self.visibility,
            owner=self.owner,
            projectId=self.projectId,
            layerId=self.layerId,
            keepInSourceBucket=self.keepInSourceBucket,
            annotationProjectId=self.annotationProjectId,
            generateTasks=self.generateTasks,
            bytesUploaded=self.bytesUploaded,
        )

    def update_upload_status(self, status):
        self.uploadStatus = status
        return self.update()

    @classmethod
    def from_dict(cls, d):
        return cls(
            d.get("uploadStatus"),
            d.get("fileType"),
            d.get("uploadType"),
            d.get("files"),
            d.get("datasource"),
            d.get("metadata"),
            d.get("visibility"),
            id=d.get("id"),
            createdAt=d.get("createdAt"),
            createdBy=d.get("createdBy"),
            modifiedAt=d.get("modifiedAt"),
            owner=d.get("owner"),
            projectId=d.get("projectId"),
            layerId=d.get("layerId"),
            keepInSourceBucket=d.get("keepInSourceBucket"),
            annotationProjectId=d.get("annotationProjectId"),
            generateTasks=d.get("generateTasks"),
            bytesUploaded=d.get("bytesUploaded"),
        )

    @classmethod
    def get_importable_uploads(cls):
        url = "{HOST}{URL_PATH}".format(HOST=cls.HOST, URL_PATH=cls.URL_PATH)
        session = get_session()
        response = session.get(url, params={"uploadStatus": "uploaded"})
        response.raise_for_status()

        parsed = response.json()
        ids = [rec["id"] for rec in parsed["results"]]
        page = 0
        while parsed["hasNext"]:
            page += 1
            parsed = session.get(
                url, params={"uploadStatus": "uploaded", "page": page}
            ).json()
            ids += [rec["id"] for rec in parsed["results"]]
        return ids
