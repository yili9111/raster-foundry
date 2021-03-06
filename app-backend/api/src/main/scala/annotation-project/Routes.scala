package com.rasterfoundry.api.annotationProject

import com.rasterfoundry.akkautil._
import com.rasterfoundry.api.utils.queryparams.QueryParametersCommon
import com.rasterfoundry.database._
import com.rasterfoundry.datamodel._

import akka.http.scaladsl.model.StatusCodes
import akka.http.scaladsl.server._
import cats.effect.IO
import cats.implicits._
import de.heikoseeberger.akkahttpcirce.ErrorAccumulatingCirceSupport._
import doobie._
import doobie.implicits._
import doobie.util.transactor.Transactor

import java.util.UUID

trait AnnotationProjectRoutes
    extends CommonHandlers
    with Directives
    with Authentication
    with PaginationDirectives
    with QueryParametersCommon
    with AnnotationProjectTaskRoutes
    with AnnotationProjectPermissionRoutes
    with LabelClassGroupRoutes
    with LabelClassRoutes {

  val xa: Transactor[IO]

  val annotationProjectRoutes: Route = {
    pathEndOrSingleSlash {
      get {
        listAnnotationProjects
      } ~
        post {
          createAnnotationProject
        }
    } ~ pathPrefix(JavaUUID) { projectId =>
      pathEndOrSingleSlash {
        get {
          getAnnotationProject(projectId)
        } ~ put {
          updateAnnotationProject(projectId)
        } ~ delete {
          deleteAnnotationProject(projectId)
        }
      } ~ pathPrefix("share") {
        pathEndOrSingleSlash {
          post {
            shareAnnotationProject(projectId)
          } ~ get {
            listAnnotationProjectShares(projectId)
          }
        } ~ pathPrefix(Segment) { deleteId =>
          pathEndOrSingleSlash {
            delete {
              deleteAnnotationProjectShare(projectId, deleteId)
            }
          }
        }
      } ~ pathPrefix("permissions") {
        pathEndOrSingleSlash {
          get {
            listPermissions(projectId)
          } ~ put {
            replacePermissions(projectId)
          } ~ post {
            addPermission(projectId)
          } ~ delete {
            deletePermissions(projectId)
          }
        }
      } ~ pathPrefix("label-class-groups") {
        pathEndOrSingleSlash {
          get {
            listLabelClassGroups(projectId)
          } ~ post {
            createLabelClassGroup(projectId)
          }
        } ~ pathPrefix(JavaUUID) { labelClassGroupId =>
          pathEndOrSingleSlash {
            get {
              getLabelClassGroup(projectId, labelClassGroupId)
            } ~ put {
              updateLabelClassGroup(projectId, labelClassGroupId)
            }
          } ~ pathPrefix("activate") {
            post {
              activateLabelClassGroup(projectId, labelClassGroupId)
            }
          } ~ pathPrefix("deactivate") {
            delete {
              deactivateLabelClassGroup(projectId, labelClassGroupId)
            }
          } ~ pathPrefix("label-classes") {
            pathEndOrSingleSlash {
              get {
                listGroupLabelClasses(projectId, labelClassGroupId)
              } ~
                post {
                  addLabelClassToGroup(projectId, labelClassGroupId)
                }
            } ~ pathPrefix(JavaUUID) { labelClassId =>
              pathEndOrSingleSlash {
                get {
                  getLabelClass(projectId, labelClassId)
                } ~ put {
                  updateLabelClass(projectId, labelClassId)
                }
              } ~ pathPrefix("activate") {
                post {
                  activateLabelClass(projectId, labelClassId)
                }
              } ~ pathPrefix("deactivate") {
                delete {
                  deactivateLabelClass(projectId, labelClassId)
                }
              }
            }
          }
        }
      } ~ pathPrefix("tasks") {
        pathEndOrSingleSlash {
          get {
            listAnnotationProjectTasks(projectId)
          } ~ post {
            createTasks(projectId)
          } ~ delete {
            deleteTasks(projectId)
          }
        } ~ pathPrefix("grid") {
          post {
            createTaskGrid(projectId)
          }
        } ~ pathPrefix("user-stats") {
          get {
            getTaskUserSummary(projectId)
          }
        } ~ pathPrefix(JavaUUID) { taskId =>
          pathEndOrSingleSlash {
            get {
              getTask(projectId, taskId)
            } ~ put {
              updateTask(projectId, taskId)
            } ~ delete {
              deleteTask(projectId, taskId)
            }
          } ~ pathPrefix("lock") {
            pathEndOrSingleSlash {
              post {
                lockTask(projectId, taskId)
              } ~ delete {
                unlockTask(projectId, taskId)
              }
            }
          } ~ pathPrefix("labels") {
            pathEndOrSingleSlash {
              get {
                listTaskLabels(projectId, taskId)
              } ~ put {
                addTaskLabels(projectId, taskId, true)
              } ~ post {
                addTaskLabels(projectId, taskId, false)
              } ~ delete {
                deleteTaskLabels(projectId, taskId)
              }
            }
          } ~ pathPrefix("validate") {
            pathEndOrSingleSlash {
              put {
                validateTaskLabels(projectId, taskId, true)
              } ~ post {
                validateTaskLabels(projectId, taskId, false)
              }
            }
          } ~ pathPrefix("children") {
            pathEndOrSingleSlash {
              get {
                children(projectId, taskId)
              }
            }
          } ~ pathPrefix("split") {
            pathEndOrSingleSlash {
              post {
                splitTask(projectId, taskId)
              }
            }
          }
        }
      } ~ pathPrefix("actions") {
        pathEndOrSingleSlash {
          get {
            listUserActions(projectId)
          }
        }
      }
    }
  }

  def listAnnotationProjects: Route =
    authenticate { user =>
      authorizeScope(
        ScopedAction(Domain.AnnotationProjects, Action.Read, None),
        user
      ) {
        (withPagination & annotationProjectQueryParameters) {
          (page, annotationProjectQP) =>
            complete {
              AnnotationProjectDao
                .listProjects(page, annotationProjectQP, user)
                .transact(xa)
                .unsafeToFuture
            }
        }
      }
    }

  def createAnnotationProject: Route =
    authenticate { user =>
      authorizeScopeLimit(
        AnnotationProjectDao
          .countUserProjects(user)
          .transact(xa)
          .unsafeToFuture,
        Domain.AnnotationProjects,
        Action.Create,
        user
      ) {
        entity(as[AnnotationProject.Create]) { newAnnotationProject =>
          onSuccess(
            AnnotationProjectDao
              .insert(newAnnotationProject, user)
              .transact(xa)
              .unsafeToFuture
          ) { annotationProject =>
            complete((StatusCodes.Created, annotationProject))
          }
        }
      }
    }

  def getAnnotationProject(projectId: UUID): Route =
    authenticate { user =>
      authorizeScope(
        ScopedAction(Domain.AnnotationProjects, Action.Read, None),
        user
      ) {
        authorizeAuthResultAsync {
          AnnotationProjectDao
            .authorized(
              user,
              ObjectType.AnnotationProject,
              projectId,
              ActionType.View
            )
            .transact(xa)
            .unsafeToFuture
        } {
          rejectEmptyResponse {
            complete {
              AnnotationProjectDao
                .getWithRelatedAndSummaryById(projectId)
                .transact(xa)
                .unsafeToFuture
            }
          }
        }
      }
    }

  def updateAnnotationProject(projectId: UUID): Route =
    authenticate { user =>
      authorizeScope(
        ScopedAction(Domain.AnnotationProjects, Action.Update, None),
        user
      ) {
        authorizeAuthResultAsync {
          AnnotationProjectDao
            .authorized(
              user,
              ObjectType.AnnotationProject,
              projectId,
              ActionType.Edit
            )
            .transact(xa)
            .unsafeToFuture
        } {
          entity(as[AnnotationProject]) { updatedAnnotationProject =>
            onSuccess(
              AnnotationProjectDao
                .update(
                  updatedAnnotationProject,
                  projectId
                )
                .transact(xa)
                .unsafeToFuture
            ) {
              completeSingleOrNotFound
            }
          }
        }
      }
    }

  def deleteAnnotationProject(projectId: UUID): Route =
    authenticate { user =>
      authorizeScope(
        ScopedAction(Domain.AnnotationProjects, Action.Delete, None),
        user
      ) {
        authorizeAuthResultAsync {
          AnnotationProjectDao
            .authorized(
              user,
              ObjectType.AnnotationProject,
              projectId,
              ActionType.Delete
            )
            .transact(xa)
            .unsafeToFuture
        } {
          onSuccess(
            AnnotationProjectDao
              .deleteById(projectId, user)
              .transact(xa)
              .unsafeToFuture
          ) {
            completeSingleOrNotFound
          }
        }
      }
    }

  def listUserActions(projectId: UUID): Route =
    authenticate { user =>
      authorizeScope(
        ScopedAction(Domain.AnnotationProjects, Action.ReadPermissions, None),
        user
      ) {
        authorizeAuthResultAsync {
          AnnotationProjectDao
            .authorized(
              user,
              ObjectType.AnnotationProject,
              projectId,
              ActionType.View
            )
            .transact(xa)
            .unsafeToFuture
        } {
          user.isSuperuser match {
            case true => complete(List("*"))
            case false =>
              onSuccess(
                AnnotationProjectDao
                  .getById(projectId)
                  .transact(xa)
                  .unsafeToFuture
              ) { projectO =>
                complete {
                  (projectO map { project =>
                    project.createdBy == user.id match {
                      case true => List("*").pure[ConnectionIO]
                      case false =>
                        AnnotationProjectDao
                          .listUserActions(user, projectId)
                    }
                  } getOrElse { List[String]().pure[ConnectionIO] })
                    .transact(xa)
                    .unsafeToFuture()
                }
              }
          }
        }
      }
    }
}
