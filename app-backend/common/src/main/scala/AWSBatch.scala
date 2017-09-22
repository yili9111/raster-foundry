package com.azavea.rf.common

import java.util.UUID

import com.typesafe.scalalogging.LazyLogging

import com.amazonaws.services.batch.AWSBatchClientBuilder
import com.amazonaws.services.batch.model.SubmitJobRequest

import scala.collection.immutable.Map
import scala.collection.JavaConversions._


/** Submits jobs to AWS Batch for processing */
trait AWSBatch extends RollbarNotifier with LazyLogging {

  val awsbatchConfig = Config.awsbatch

  val batchClient = AWSBatchClientBuilder.defaultClient()

  def submitJobRequest(jobDefinition: String, jobQueueName: String, parameters: Map[String, String], jobName: String) = {
    val jobRequest = new SubmitJobRequest()
      .withJobName(jobName)
      .withJobDefinition(jobDefinition)
      .withJobQueue(jobQueueName)
      .withParameters(parameters)

    val submitJobResult = batchClient.submitJob(jobRequest)

    logger.info("submit job result: {}", submitJobResult)
    submitJobResult
  }

  def kickoffSceneIngest(sceneId: UUID) = {
    val jobDefinition = awsbatchConfig.ingestJobName
    val jobName = s"jobDefinition-$sceneId"
    submitJobRequest(jobDefinition, awsbatchConfig.jobQueue, Map("sceneId" -> s"$sceneId"), jobName)
  }

  def kickoffSceneImport(uploadId: UUID) = {
    val jobDefinition = awsbatchConfig.importJobName
    val jobName = s"jobDefinition-$uploadId"
    submitJobRequest(jobDefinition, awsbatchConfig.jobQueue, Map("uploadId" -> s"$uploadId"), jobName)
  }

  def kickoffProjectExport(exportId: UUID) = {
    val jobDefinition = awsbatchConfig.exportJobName
    val jobName = s"jobDefinition-$exportId"
    submitJobRequest(jobDefinition, awsbatchConfig.jobQueue, Map("exportId" -> s"$exportId"), jobName)
  }
}